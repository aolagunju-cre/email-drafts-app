"use client";

import { useState, useEffect } from "react";
import styles from "./dashboard.module.css";

interface Draft {
  id: string;
  to: string;
  subject: string;
  body: string;
  status: "draft" | "generated" | "edited" | "sending" | "sent" | "failed";
}

interface GenerateFormData {
  prospectName: string;
  prospectCompany: string;
  propertyInterest: string;
  additionalContext: string;
}

export default function Dashboard() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);
  const [formData, setFormData] = useState<GenerateFormData>({
    prospectName: "",
    prospectCompany: "",
    propertyInterest: "",
    additionalContext: "",
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const stats = {
    total: drafts.length,
    draft: drafts.filter((d) => d.status === "draft").length,
    generated: drafts.filter((d) => d.status === "generated").length,
    sent: drafts.filter((d) => d.status === "sent").length,
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setMessage(null);
    setDrafts([]);

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
          to: draft.to || formData.prospectName,
          subject: draft.subject,
          body: draft.body,
          status: "generated" as const,
        })
      );

      setDrafts(newDrafts);
      setMessage({ type: "success", text: `${newDrafts.length} drafts generated! Review and edit below.` });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate drafts";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditDraft = (draft: Draft) => {
    setEditingDraft({ ...draft });
  };

  const handleSaveEdit = () => {
    if (editingDraft) {
      setDrafts((prev) => prev.map((d) => (d.id === editingDraft.id ? { ...editingDraft, status: "edited" as const } : d)));
      setEditingDraft(null);
      setMessage({ type: "success", text: "Draft updated!" });
    }
  };

  const handleSendDraft = async (draftId: string) => {
    const draft = drafts.find((d) => d.id === draftId);
    if (!draft) return;

    // Update status to sending
    setDrafts((prev) => prev.map((d) => (d.id === draftId ? { ...d, status: "sending" as const } : d)));
    setMessage(null);

    try {
      const response = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: draft.to,
          subject: draft.subject,
          body: draft.body,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Send failed");

      setDrafts((prev) => prev.map((d) => (d.id === draftId ? { ...d, status: "sent" as const } : d)));
      setMessage({ type: "success", text: `Email sent to ${draft.to}!` });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send";
      setDrafts((prev) => prev.map((d) => (d.id === draftId ? { ...d, status: "failed" as const } : d)));
      setMessage({ type: "error", text: errorMessage });
    }
  };

  const handleSendAll = async () => {
    const unsentDrafts = drafts.filter((d) => ["generated", "edited"].includes(d.status));
    if (unsentDrafts.length === 0) {
      setMessage({ type: "error", text: "No drafts to send" });
      return;
    }

    for (const draft of unsentDrafts) {
      await handleSendDraft(draft.id);
    }
  };

  const handleDeleteDraft = (draftId: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== draftId));
  };

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
            <a href="/dashboard" className={styles.navLinkActive}>
              Dashboard
            </a>
            <a href="/dashboard/emails" className={styles.navLink}>
              Emails
            </a>
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        <h1 className={styles.pageTitle}>Email Draft Generator</h1>

        {/* Stats */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Total Drafts</div>
            <div className={styles.statValue}>{stats.total}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Pending Review</div>
            <div className={styles.statValue}>{stats.generated + stats.edited}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Sent</div>
            <div className={styles.statValue}>{stats.sent}</div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={message.type === "error" ? styles.error : styles.success}>
            {message.text}
          </div>
        )}

        {/* Generate Form */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Generate Email Drafts</h2>
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
                    placeholder="John Smith"
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
                    placeholder="Acme Corp"
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
                    placeholder="Downtown Calgary office space"
                  />
                </div>
                <div className={styles.formGroupFull}>
                  <label className={styles.formLabel}>Additional Context</label>
                  <textarea
                    className={styles.formTextarea}
                    value={formData.additionalContext}
                    onChange={(e) => setFormData({ ...formData, additionalContext: e.target.value })}
                    placeholder="Any specific details about the prospect, their needs, or what you want to emphasize..."
                    rows={3}
                  />
                </div>
              </div>
              <button type="submit" className={styles.generateButton} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <span className={styles.spinner}></span>
                    Generating...
                  </>
                ) : (
                  "Generate Drafts"
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Generated Drafts */}
        {drafts.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Generated Drafts</h2>
              <button className={styles.sendAllButton} onClick={handleSendAll} disabled={drafts.filter((d) => ["generated", "edited"].includes(d.status)).length === 0}>
                Send All via Email
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
                          <button className={styles.actionButton} onClick={() => handleEditDraft(draft)}>
                            Edit
                          </button>
                          <button className={styles.actionButtonPrimary} onClick={() => handleSendDraft(draft.id)}>
                            Send Email
                          </button>
                        </>
                      )}
                      <button className={styles.actionButtonDanger} onClick={() => handleDeleteDraft(draft.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className={styles.draftBody}>
                    <div className={styles.draftField}>
                      <span className={styles.draftLabel}>To:</span>
                      <span className={styles.draftValue}>{draft.to}</span>
                    </div>
                    <div className={styles.draftField}>
                      <span className={styles.draftLabel}>Subject:</span>
                      <span className={styles.draftValue}>{draft.subject}</span>
                    </div>
                    <div className={styles.draftField}>
                      <span className={styles.draftLabel}>Body:</span>
                      <pre className={styles.draftBodyText}>{draft.body}</pre>
                    </div>
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
              <input
                type="text"
                className={styles.formInput}
                value={editingDraft.to}
                onChange={(e) => setEditingDraft({ ...editingDraft, to: e.target.value })}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Subject:</label>
              <input
                type="text"
                className={styles.formInput}
                value={editingDraft.subject}
                onChange={(e) => setEditingDraft({ ...editingDraft, subject: e.target.value })}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Body:</label>
              <textarea
                className={styles.formTextarea}
                value={editingDraft.body}
                onChange={(e) => setEditingDraft({ ...editingDraft, body: e.target.value })}
                rows={10}
              />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.actionButton} onClick={() => setEditingDraft(null)}>
                Cancel
              </button>
              <button className={styles.actionButtonPrimary} onClick={handleSaveEdit}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}