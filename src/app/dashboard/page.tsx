"use client";

import { useState, useEffect } from "react";
import styles from "./dashboard.module.css";

interface Draft {
  id: string;
  to: string;
  subject: string;
  body: string;
  status: "draft" | "generated" | "edited";
}

interface Prospect {
  recordId: string;
  name: string;
  email: string;
  title: string;
  companyName: string;
  phone: string;
  location: string;
  entryId: string;
}

interface GenerateFormData {
  prospectName: string;
  prospectEmail: string;
  prospectCompany: string;
  propertyInterest: string;
  additionalContext: string;
}

function buildMailto(to: string, subject: string, body: string): string {
  const subjectEncoded = encodeURIComponent(subject);
  const bodyEncoded = encodeURIComponent(body);
  return `mailto:${encodeURIComponent(to)}?subject=${subjectEncoded}&body=${bodyEncoded}`;
}

export default function Dashboard() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loadingProspects, setLoadingProspects] = useState(true);
  const [prospectsError, setProspectsError] = useState<string | null>(null);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [isManualGenerating, setIsManualGenerating] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);
  const [activeProspect, setActiveProspect] = useState<Prospect | null>(null);
  const [formData, setFormData] = useState<GenerateFormData>({
    prospectName: "",
    prospectEmail: "",
    prospectCompany: "",
    propertyInterest: "",
    additionalContext: "",
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load prospects from Attio on mount
  useEffect(() => {
    fetch("/api/prospects")
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/login";
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        if (data.error) {
          setProspectsError(data.error);
        } else {
          setProspects(data.prospects || []);
        }
      })
      .catch((err) => setProspectsError(err.message))
      .finally(() => setLoadingProspects(false));
  }, []);

  const handleSelectProspect = (prospect: Prospect) => {
    setActiveProspect(prospect);
    setFormData({
      prospectName: prospect.name,
      prospectEmail: prospect.email,
      prospectCompany: prospect.companyName,
      propertyInterest: "",
      additionalContext: "",
    });
    setDrafts([]);
    setMessage(null);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsManualGenerating(true);
    setMessage(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Generation failed");

      const newDrafts: Draft[] = data.drafts.map(
        (draft: { to: string; subject: string; body: string }, i: number) => ({
          id: `draft-${Date.now()}-${i}`,
          to: draft.to || formData.prospectEmail || formData.prospectName,
          subject: draft.subject,
          body: draft.body,
          status: "generated" as const,
        })
      );

      setDrafts(newDrafts);
      setMessage({ type: "success", text: `${newDrafts.length} draft generated for ${formData.prospectName}. Review and click "Open in Email".` });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate drafts";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setIsManualGenerating(false);
    }
  };

  const handleEditDraft = (draft: Draft) => setEditingDraft({ ...draft });

  const handleSaveEdit = () => {
    if (!editingDraft) return;
    setDrafts((prev) =>
      prev.map((d) => d.id === editingDraft.id ? { ...editingDraft, status: "edited" as const } : d)
    );
    setEditingDraft(null);
    setMessage({ type: "success", text: "Draft updated!" });
  };

  const handleOpenInEmail = (draft: Draft) => {
    // Use anchor trick — window.location.href kills the event loop after the first open
    const a = document.createElement("a");
    a.href = buildMailto(draft.to, draft.subject, draft.body);
    a.click();
    setDrafts((prev) =>
      prev.map((d) => d.id === draft.id ? { ...d, status: "draft" as const } : d)
    );
    setMessage({ type: "success", text: `Opening ${draft.to} in your email client...` });
  };

  const handleOpenAll = () => {
    if (drafts.length === 0) return;
    drafts.forEach((draft, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = buildMailto(draft.to, draft.subject, draft.body);
        a.click();
      }, i * 1500);
    });
    setMessage({ type: "success", text: `Opening ${drafts.length} drafts in your email client…` });
  };

  const handleDeleteDraft = (draftId: string) =>
    setDrafts((prev) => prev.filter((d) => d.id !== draftId));

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.brand}>
            <span className={styles.logo}>📧</span>
            <span className={styles.brandName}>Email Drafts</span>
          </div>
          <nav className={styles.nav}>
            <a href="/dashboard" className={styles.navLinkActive}>Dashboard</a>
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        <h1 className={styles.pageTitle}>Email Draft Generator</h1>

        {message && (
          <div className={message.type === "error" ? styles.error : styles.success}>
            {message.text}
          </div>
        )}

        {/* Prospect selector */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Email Campaign Prospects</h2>
          </div>
          <div className={styles.sectionContent}>
            {loadingProspects ? (
              <p className={styles.emptyState}>Loading prospects from Attio...</p>
            ) : prospectsError ? (
              <p className={styles.error}>Error: {prospectsError}</p>
            ) : prospects.length === 0 ? (
              <p className={styles.emptyState}>No prospects with Email_Campaign checked in Attio.</p>
            ) : (
              <div className={styles.prospectsGrid}>
                {prospects.map((p) => (
                  <div
                    key={p.recordId}
                    className={`${styles.prospectCard} ${activeProspect?.recordId === p.recordId ? styles.prospectCardActive : ""}`}
                    onClick={() => handleSelectProspect(p)}
                  >
                    <div className={styles.prospectName}>{p.name}</div>
                    <div className={styles.prospectMeta}>{p.title}</div>
                    <div className={styles.prospectMeta}>{p.companyName}</div>
                    <div className={styles.prospectEmail}>{p.email}</div>
                    {activeProspect?.recordId === p.recordId && (
                      <div className={styles.prospectActiveBadge}>✓ Selected</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Generate Form — shown when a prospect is selected */}
        {activeProspect && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                Generate for {activeProspect.name}
              </h2>
            </div>
            <div className={styles.sectionContent}>
              <form onSubmit={handleGenerate} className={styles.generateForm}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Prospect Name *</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={formData.prospectName}
                      onChange={(e) => setFormData({ ...formData, prospectName: e.target.value })}
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Email *</label>
                    <input
                      type="email"
                      className={styles.formInput}
                      value={formData.prospectEmail || ""}
                      onChange={(e) => setFormData({ ...formData, prospectEmail: e.target.value })}
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Company *</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={formData.prospectCompany}
                      onChange={(e) => setFormData({ ...formData, prospectCompany: e.target.value })}
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Property Interest</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={formData.propertyInterest}
                      onChange={(e) => setFormData({ ...formData, propertyInterest: e.target.value })}
                      placeholder="e.g. Downtown Calgary office, Class A"
                    />
                  </div>
                  <div className={styles.formGroupFull}>
                    <label className={styles.formLabel}>Additional Context</label>
                    <textarea
                      className={styles.formTextarea}
                      value={formData.additionalContext}
                      onChange={(e) => setFormData({ ...formData, additionalContext: e.target.value })}
                      placeholder="Any specific details about their needs, budget, timeline..."
                      rows={3}
                    />
                  </div>
                </div>
                <button type="submit" className={styles.generateButton} disabled={isManualGenerating}>
                  {isManualGenerating ? "Generating..." : "Generate Draft"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Generated Drafts */}
        {drafts.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Generated Drafts</h2>
              <button className={styles.actionButtonPrimary} onClick={handleOpenAll}>
                Open All ({drafts.length})
              </button>
            </div>
            <div className={styles.sectionContent}>
              {drafts.map((draft) => (
                <div key={draft.id} className={styles.draftCard}>
                  <div className={styles.draftHeader}>
                    <span className={`${styles.draftStatus} ${styles[`status${draft.status.charAt(0).toUpperCase() + draft.status.slice(1)}`]}`}>
                      {draft.status}
                    </span>
                    <div className={styles.draftActions}>
                      {["generated", "edited"].includes(draft.status) && (
                        <>
                          <button className={styles.actionButton} onClick={() => handleEditDraft(draft)}>Edit</button>
                          <button className={styles.actionButtonPrimary} onClick={() => handleOpenInEmail(draft)}>Open in Email</button>
                        </>
                      )}
                      <button className={styles.actionButtonDanger} onClick={() => handleDeleteDraft(draft.id)}>Delete</button>
                    </div>
                  </div>
                  <div className={styles.draftBody}>
                    <div className={styles.draftField}><span className={styles.draftLabel}>To:</span><span className={styles.draftValue}>{draft.to}</span></div>
                    <div className={styles.draftField}><span className={styles.draftLabel}>Subject:</span><span className={styles.draftValue}>{draft.subject}</span></div>
                    <div className={styles.draftField}><span className={styles.draftLabel}>Body:</span><pre className={styles.draftBodyText}>{draft.body}</pre></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Edit Modal */}
      {editingDraft && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>Edit Draft</h2>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>To:</label>
              <input type="text" className={styles.formInput} value={editingDraft.to}
                onChange={(e) => setEditingDraft({ ...editingDraft, to: e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Subject:</label>
              <input type="text" className={styles.formInput} value={editingDraft.subject}
                onChange={(e) => setEditingDraft({ ...editingDraft, subject: e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Body:</label>
              <textarea className={styles.formTextarea} value={editingDraft.body}
                onChange={(e) => setEditingDraft({ ...editingDraft, body: e.target.value })} rows={10} />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.actionButton} onClick={() => setEditingDraft(null)}>Cancel</button>
              <button className={styles.actionButtonPrimary} onClick={() => {
                const draft = editingDraft;
                handleSaveEdit();
                if (draft) handleOpenInEmail(draft);
              }}>Save &amp; Open in Email</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
