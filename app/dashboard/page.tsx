"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Send, Mail, Edit3, Trash2, CheckCircle, Loader2,
  RefreshCw, ExternalLink, Upload,
} from "lucide-react";
import { type Template, CONTACT_VARS, renderTemplate } from "@/lib/templates";

// ─── Types ───────────────────────────────────────────────────────────────────

type Source = "attio" | "csv" | "manual";

interface Contact {
  name: string;
  email: string;
  company: string;
  job_title?: string;
  web_url?: string;
}

interface Draft {
  id: string;
  to: string;
  subject: string;
  body: string;
  status: "generated" | "edited";
  name?: string;
  web_url?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

function buildMailto(to: string, subject: string, body: string) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const SOURCE_LABELS: Record<Source, string> = {
  attio: "Attio CRM",
  csv: "CSV / Excel",
  manual: "Manual Entry",
};

const ATTIO_PRESETS = [5, 10, 20, 50];

// ─── Component ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  // Source tab
  const [source, setSource] = useState<Source>("attio");

  // Attio
  const [attioCount, setAttioCount] = useState(5);
  const [attioContacts, setAttioContacts] = useState<Contact[]>([]);
  const [fetchingAttio, setFetchingAttio] = useState(false);

  // CSV
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [csvContacts, setCsvContacts] = useState<Contact[]>([]);
  const [csvSkipped, setCsvSkipped] = useState(0);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  // Manual
  const [manualForm, setManualForm] = useState({ name: "", email: "", company: "" });

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("__default__");
  const [extraVars, setExtraVars] = useState<Record<string, string>>({});

  // Generate + drafts
  const [isGenerating, setIsGenerating] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => setTemplates((d.templates || []).filter((t: Template) => !t.archived)))
      .catch(() => {});
  }, []);

  // Derived contacts from active source
  const activeContacts = useMemo<Contact[]>(() => {
    if (source === "attio") return attioContacts;
    if (source === "csv") return csvContacts;
    if (source === "manual" && manualForm.email.trim())
      return [{ name: manualForm.name, email: manualForm.email, company: manualForm.company }];
    return [];
  }, [source, attioContacts, csvContacts, manualForm]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;
  const extraVarFields = selectedTemplate
    ? selectedTemplate.variables.filter((v) => !CONTACT_VARS.has(v))
    : [];

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleFetchAttio = async () => {
    setFetchingAttio(true);
    setAttioContacts([]);
    try {
      const res = await fetch(`/api/attio/contacts?limit=${attioCount}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const contacts: Contact[] = (data.contacts || []).map((c: Contact & { record_id: string }) => ({
        name: c.name,
        email: c.email,
        company: c.company,
        job_title: c.job_title,
        web_url: c.web_url,
      }));
      setAttioContacts(contacts);
      if (contacts.length === 0)
        toast.error("No contacts found", {
          description: "Check that contacts have Email_Campaign ticked in Attio.",
        });
      else toast.success(`${contacts.length} contacts fetched`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch contacts");
    } finally {
      setFetchingAttio(false);
    }
  };

  const handleFile = async (file: File) => {
    setCsvError(null);
    setCsvContacts([]);
    setCsvFileName(file.name);

    const XLSX = await import("xlsx");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

        if (rows.length === 0) { setCsvError("File is empty or has no data rows"); return; }

        const normalize = (k: string) => k.toLowerCase().trim().replace(/[\s_-]+/g, "_");

        const findVal = (row: Record<string, unknown>, variants: string[]): string => {
          for (const [k, v] of Object.entries(row)) {
            if (variants.includes(normalize(k))) return String(v ?? "").trim();
          }
          return "";
        };

        const emailVariants = ["email", "email_address", "emailaddress", "e_mail"];
        const firstVariants = ["first_name", "firstname", "first", "given_name"];
        const lastVariants = ["last_name", "lastname", "last", "surname", "family_name"];
        const companyVariants = ["company", "company_name", "organization", "org", "employer"];

        const hasEmail = rows.some((r) =>
          Object.keys(r).some((k) => emailVariants.includes(normalize(k)))
        );
        if (!hasEmail) {
          setCsvError("No email column found. Expected: first_name, last_name, email");
          return;
        }

        let skipped = 0;
        const contacts: Contact[] = [];

        for (const row of rows) {
          const email = findVal(row, emailVariants);
          if (!email || !email.includes("@")) { skipped++; continue; }
          const first = findVal(row, firstVariants);
          const last = findVal(row, lastVariants);
          const name = `${first} ${last}`.trim() || email.split("@")[0];
          const company = findVal(row, companyVariants);
          contacts.push({ name, email, company });
        }

        setCsvContacts(contacts);
        setCsvSkipped(skipped);
        if (contacts.length === 0) setCsvError("No valid contacts found — all rows are missing a valid email.");
      } catch {
        setCsvError("Failed to parse file. Make sure it's a valid CSV or Excel file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleGenerate = async () => {
    if (activeContacts.length === 0) return;
    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contacts: activeContacts.map((c) => ({
            name: c.name, email: c.email, company: c.company, job_title: c.job_title,
          })),
          ...(selectedTemplate
            ? { subject: selectedTemplate.subject, body: selectedTemplate.body, extraVars }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const newDrafts: Draft[] = data.drafts.map(
        (d: { to: string; subject: string; body: string }, i: number) => ({
          id: `draft-${Date.now()}-${i}`,
          to: d.to,
          subject: d.subject,
          body: d.body,
          status: "generated" as const,
          name: activeContacts[i]?.name || "",
          web_url: activeContacts[i]?.web_url || "",
        })
      );
      setDrafts((prev) => [...newDrafts, ...prev]);
      toast.success(`${newDrafts.length} draft${newDrafts.length !== 1 ? "s" : ""} generated`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenInEmail = (draft: Draft) => {
    const a = document.createElement("a");
    a.href = buildMailto(draft.to, draft.subject, draft.body);
    a.click();
    toast(`Opening email for ${draft.name || draft.to}…`);
  };

  const handleSaveEdit = () => {
    if (!editingDraft) return;
    setDrafts((prev) =>
      prev.map((d) => d.id === editingDraft.id ? { ...editingDraft, status: "edited" as const } : d)
    );
    setEditingDraft(null);
    toast.success("Draft updated");
  };

  const handleOpenAll = () => {
    drafts.forEach((draft, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = buildMailto(draft.to, draft.subject, draft.body);
        a.click();
      }, i * 500);
    });
    toast.success(`Opening ${drafts.length} drafts…`);
  };

  // ─── Derived UI values ─────────────────────────────────────────────────────

  const generateLabel = activeContacts.length > 0
    ? `Generate ${activeContacts.length} Draft${activeContacts.length !== 1 ? "s" : ""}`
    : "Generate Drafts";

  const previewVars = {
    first_name: firstName(manualForm.name) || "Alex",
    company: manualForm.company || "Acme Corp",
    ...extraVars,
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">

      {/* Drafts toolbar */}
      {drafts.length > 0 && (
        <div className="flex items-center justify-between">
          <Badge variant="outline">{drafts.length} draft{drafts.length !== 1 ? "s" : ""}</Badge>
          <Button size="sm" variant="outline" onClick={handleOpenAll}>
            <Mail className="h-4 w-4" /> Open All ({drafts.length})
          </Button>
        </div>
      )}

      {/* ── 1. Select Contacts ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Select Contacts</CardTitle>
          <CardDescription>Choose where to pull your prospects from.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Tab strip */}
          <div className="flex border-b">
            {(["attio", "csv", "manual"] as Source[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setSource(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  source === tab
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {SOURCE_LABELS[tab]}
              </button>
            ))}
          </div>

          {/* Attio tab */}
          {source === "attio" && (
            <div className="space-y-4 pt-1">
              <div className="space-y-2">
                <Label>Contacts to pull</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={attioCount}
                    onChange={(e) => setAttioCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24"
                  />
                  <div className="flex gap-1">
                    {ATTIO_PRESETS.map((n) => (
                      <button
                        key={n}
                        onClick={() => setAttioCount(n)}
                        className={`px-2 py-1 text-xs rounded border transition-colors ${
                          attioCount === n
                            ? "bg-blue-50 border-blue-300 text-blue-700"
                            : "border-slate-200 text-muted-foreground hover:border-slate-300"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <Button variant="outline" onClick={handleFetchAttio} disabled={fetchingAttio}>
                {fetchingAttio ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Fetching…</>
                ) : (
                  <><RefreshCw className="h-4 w-4" /> Fetch Contacts from Attio</>
                )}
              </Button>
              {attioContacts.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-green-600">
                    ✓ {attioContacts.length} contact{attioContacts.length !== 1 ? "s" : ""} loaded
                  </p>
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {["Name", "Company", "Email"].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {attioContacts.slice(0, 5).map((c, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-3 py-2">{c.name}</td>
                            <td className="px-3 py-2 text-muted-foreground">{c.company || "—"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{c.email}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {attioContacts.length > 5 && (
                      <p className="px-3 py-2 text-xs text-muted-foreground bg-slate-50 border-t">
                        and {attioContacts.length - 5} more…
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CSV tab */}
          {source === "csv" && (
            <div className="space-y-4 pt-1">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragging ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleFile(file);
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
                />
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Drop a CSV or Excel file here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse · .csv, .xlsx, .xls</p>
                <p className="text-xs text-muted-foreground mt-3 font-mono bg-slate-100 inline-block px-2 py-1 rounded">
                  first_name · last_name · email · company (optional)
                </p>
              </div>

              {csvError && <p className="text-sm text-red-500">{csvError}</p>}

              {csvContacts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-green-600">
                    ✓ {csvContacts.length} contact{csvContacts.length !== 1 ? "s" : ""} loaded from{" "}
                    <span className="font-mono">{csvFileName}</span>
                    {csvSkipped > 0 && (
                      <span className="text-amber-600 ml-2">· {csvSkipped} skipped (no valid email)</span>
                    )}
                  </p>
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {["Name", "Company", "Email"].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvContacts.slice(0, 5).map((c, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-3 py-2">{c.name}</td>
                            <td className="px-3 py-2 text-muted-foreground">{c.company || "—"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{c.email}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {csvContacts.length > 5 && (
                      <p className="px-3 py-2 text-xs text-muted-foreground bg-slate-50 border-t">
                        and {csvContacts.length - 5} more…
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manual tab */}
          {source === "manual" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={manualForm.name}
                  onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                  placeholder="John Smith"
                />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={manualForm.email}
                  onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
                  placeholder="john@acmecorp.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Input
                  value={manualForm.company}
                  onChange={(e) => setManualForm({ ...manualForm, company: e.target.value })}
                  placeholder="Acme Corp"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 2. Email Template ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Email Template</CardTitle>
          <CardDescription>Choose which template to use for this batch.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Template</Label>
            <Select
              value={selectedTemplateId}
              onValueChange={(v) => { setSelectedTemplateId(v); setExtraVars({}); }}
            >
              <SelectTrigger className="w-full sm:w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">Default (General Cold Outreach)</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Extra vars */}
          {extraVarFields.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-md border">
              <p className="col-span-full text-sm font-medium text-muted-foreground">
                Fill in template variables
              </p>
              {extraVarFields.map((v) => (
                <div key={v} className="space-y-1.5">
                  <Label className="font-mono text-xs">{"{" + v + "}"}</Label>
                  <Input
                    value={extraVars[v] || ""}
                    onChange={(e) => setExtraVars({ ...extraVars, [v]: e.target.value })}
                    placeholder={v.replace(/_/g, " ")}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Live preview (only for manual — gives useful per-contact preview) */}
          {source === "manual" && selectedTemplate && (
            <div className="bg-slate-50 rounded-md p-3 border space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Preview</p>
              <p className="text-sm font-medium">
                Subject: {renderTemplate(selectedTemplate.subject, previewVars)}
              </p>
              <pre className="text-sm whitespace-pre-wrap text-muted-foreground">
                {renderTemplate(selectedTemplate.body, previewVars)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 3. Generate button ── */}
      <Button
        size="lg"
        className="w-full"
        onClick={handleGenerate}
        disabled={isGenerating || activeContacts.length === 0}
      >
        {isGenerating ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
        ) : (
          <><Send className="h-4 w-4" /> {generateLabel}</>
        )}
      </Button>

      {/* ── 4. Drafts ── */}
      {drafts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Drafts</h2>
          {drafts.map((draft) => (
            <Card key={draft.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={draft.status === "edited" ? "secondary" : "default"}>
                        {draft.status === "edited" ? "Edited" : "Generated"}
                      </Badge>
                      {draft.name && (
                        <span className="text-sm text-muted-foreground">{draft.name}</span>
                      )}
                    </div>
                    <CardTitle className="text-base">{draft.subject}</CardTitle>
                    <CardDescription className="truncate">To: {draft.to}</CardDescription>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" variant="outline" onClick={() => setEditingDraft({ ...draft })}>
                      <Edit3 className="h-4 w-4" /> Edit
                    </Button>
                    {draft.web_url && (
                      <a href={draft.web_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline">
                          <ExternalLink className="h-4 w-4" /> Attio
                        </Button>
                      </a>
                    )}
                    <Button size="sm" onClick={() => handleOpenInEmail(draft)}>
                      <Send className="h-4 w-4" /> Open in Email
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDrafts((prev) => prev.filter((d) => d.id !== draft.id))}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm text-muted-foreground bg-slate-100 rounded-md p-3">
                  {draft.body}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Edit modal ── */}
      {editingDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Edit Draft</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>To</Label>
                <Input
                  value={editingDraft.to}
                  onChange={(e) => setEditingDraft({ ...editingDraft, to: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={editingDraft.subject}
                  onChange={(e) => setEditingDraft({ ...editingDraft, subject: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Body</Label>
                <Textarea
                  value={editingDraft.body}
                  onChange={(e) => setEditingDraft({ ...editingDraft, body: e.target.value })}
                  rows={10}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingDraft(null)}>Cancel</Button>
                <Button onClick={() => { handleSaveEdit(); if (editingDraft) handleOpenInEmail(editingDraft); }}>
                  <CheckCircle className="h-4 w-4" /> Save &amp; Open in Email
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
