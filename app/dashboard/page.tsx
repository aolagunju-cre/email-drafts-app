"use client";

import { useState, useEffect } from "react";
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
  Send,
  Mail,
  Edit3,
  Trash2,
  CheckCircle,
  Loader2,
  Sparkles,
  Users,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { type Template, CONTACT_VARS, renderTemplate } from "@/lib/templates";

interface Draft {
  id: string;
  to: string;
  subject: string;
  body: string;
  status: "generated" | "edited";
  name?: string;
  web_url?: string;
}

interface AttioContact {
  record_id: string;
  name: string;
  email: string;
  company: string;
  job_title: string;
  web_url: string;
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

function buildMailto(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function Dashboard() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFetchingContacts, setIsFetchingContacts] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);
  const [draftCount, setDraftCount] = useState<string>("5");
  const [formData, setFormData] = useState({
    prospectName: "",
    prospectEmail: "",
    prospectCompany: "",
  });

  // Template state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("__default__");
  const [extraVars, setExtraVars] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => setTemplates((d.templates || []).filter((t: Template) => !t.archived)))
      .catch(() => {/* non-fatal */});
  }, []);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  // Variables that aren't auto-filled from contact data
  const extraVarFields = selectedTemplate
    ? selectedTemplate.variables.filter((v) => !CONTACT_VARS.has(v))
    : [];

  // Reset extra vars when template changes
  const handleTemplateChange = (id: string) => {
    setSelectedTemplateId(id);
    setExtraVars({});
  };

  const handleAutoGenerate = async () => {
    setIsGenerating(true);
    setIsFetchingContacts(true);

    try {
      const contactsRes = await fetch(`/api/attio/contacts?limit=${draftCount}`);
      const contactsData = await contactsRes.json();

      if (!contactsRes.ok) {
        throw new Error(contactsData.error || "Failed to fetch contacts from Attio");
      }

      const contacts: AttioContact[] = contactsData.contacts;

      if (contacts.length === 0) {
        toast.error("No contacts found in Attio", {
          description: "Check that contacts have the Email_Campaign checkbox ticked.",
        });
        return;
      }

      setIsFetchingContacts(false);

      const generateRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contacts: contacts.map((c) => ({
            name: c.name,
            email: c.email,
            company: c.company,
            job_title: c.job_title,
          })),
          ...(selectedTemplate
            ? { subject: selectedTemplate.subject, body: selectedTemplate.body, extraVars }
            : {}),
        }),
      });

      const generateData = await generateRes.json();
      if (!generateRes.ok) throw new Error(generateData.error || "Failed to generate drafts");

      const newDrafts: Draft[] = generateData.drafts.map(
        (draft: { to: string; subject: string; body: string }, i: number) => ({
          id: `draft-${Date.now()}-${i}`,
          to: draft.to,
          subject: draft.subject,
          body: draft.body,
          status: "generated" as const,
          name: contacts[i]?.name || "",
          web_url: contacts[i]?.web_url || "",
        })
      );

      setDrafts((prev) => [...newDrafts, ...prev]);
      toast.success(`${newDrafts.length} drafts generated from Attio`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setIsGenerating(false);
      setIsFetchingContacts(false);
    }
  };

  const handleManualGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectName: formData.prospectName,
          prospectEmail: formData.prospectEmail,
          prospectCompany: formData.prospectCompany,
          ...(selectedTemplate
            ? { subject: selectedTemplate.subject, body: selectedTemplate.body, extraVars }
            : {}),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Generation failed");

      const newDrafts: Draft[] = data.drafts.map(
        (draft: { to: string; subject: string; body: string }, i: number) => ({
          id: `draft-${Date.now()}-${i}`,
          to: draft.to,
          subject: draft.subject,
          body: draft.body,
          status: "generated" as const,
        })
      );

      setDrafts((prev) => [...newDrafts, ...prev]);
      toast.success(`${newDrafts.length} draft generated`);
    } catch (err: unknown) {
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
    if (editingDraft) {
      setDrafts((prev) =>
        prev.map((d) => d.id === editingDraft.id ? { ...editingDraft, status: "edited" as const } : d)
      );
      setEditingDraft(null);
      toast.success("Draft updated");
    }
  };

  const handleOpenAll = () => {
    if (drafts.length === 0) return;
    drafts.forEach((draft, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = buildMailto(draft.to, draft.subject, draft.body);
        a.click();
      }, i * 500);
    });
    toast.success(`Opening ${drafts.length} drafts in your email client…`);
  };

  // Live preview for template + manual form
  const previewSubject = selectedTemplate
    ? renderTemplate(selectedTemplate.subject, {
        first_name: firstName(formData.prospectName) || "Alex",
        company: formData.prospectCompany || "Acme Corp",
        ...extraVars,
      })
    : "";
  const previewBody = selectedTemplate
    ? renderTemplate(selectedTemplate.body, {
        first_name: firstName(formData.prospectName) || "Alex",
        company: formData.prospectCompany || "Acme Corp",
        ...extraVars,
      })
    : "";

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      {/* Draft toolbar */}
      {drafts.length > 0 && (
        <div className="flex items-center justify-between">
          <Badge variant="outline">{drafts.length} draft{drafts.length !== 1 ? "s" : ""}</Badge>
          <Button size="sm" variant="outline" onClick={handleOpenAll}>
            <Mail className="h-4 w-4" />
            Open All ({drafts.length})
          </Button>
        </div>
      )}

      {/* Auto Generate card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            Auto Generate from Attio CRM
          </CardTitle>
          <CardDescription>
            Pull contacts from Attio and generate personalized emails for all of them at once.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Number of drafts</Label>
              <Select value={draftCount} onValueChange={setDraftCount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 3, 5, 10, 15, 20].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} draft{n !== 1 ? "s" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Default (hardcoded)</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Extra variable inputs for selected template */}
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

          <Button
            onClick={handleAutoGenerate}
            disabled={isGenerating}
            className="w-full sm:w-auto"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isFetchingContacts ? "Fetching contacts…" : "Generating…"}
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Auto Generate {draftCount}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-slate-50 px-4 text-sm text-muted-foreground">
            Or enter one prospect manually
          </span>
        </div>
      </div>

      {/* Manual Generate card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-4 w-4 text-blue-500" />
            Manual Prospect Entry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleManualGenerate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prospectName">Prospect Name *</Label>
                <Input
                  id="prospectName"
                  value={formData.prospectName}
                  onChange={(e) => setFormData({ ...formData, prospectName: e.target.value })}
                  placeholder="John Smith"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prospectEmail">Prospect Email *</Label>
                <Input
                  id="prospectEmail"
                  type="email"
                  value={formData.prospectEmail}
                  onChange={(e) => setFormData({ ...formData, prospectEmail: e.target.value })}
                  placeholder="john@acmecorp.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prospectCompany">Company *</Label>
                <Input
                  id="prospectCompany"
                  value={formData.prospectCompany}
                  onChange={(e) => setFormData({ ...formData, prospectCompany: e.target.value })}
                  placeholder="Acme Corp"
                />
              </div>
            </div>

            {/* Extra vars for manual too */}
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

            {/* Live preview */}
            {selectedTemplate && previewBody && (
              <div className="bg-slate-50 rounded-md p-3 border space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Preview</p>
                <p className="text-sm font-medium">Subject: {previewSubject}</p>
                <pre className="text-sm whitespace-pre-wrap text-muted-foreground">{previewBody}</pre>
              </div>
            )}

            <Button type="submit" disabled={isGenerating} variant="outline">
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Single Draft
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Drafts list */}
      {drafts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Your Drafts</h2>
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
                      <Edit3 className="h-4 w-4" />
                      Edit
                    </Button>
                    {draft.web_url && (
                      <a href={draft.web_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline">
                          <ExternalLink className="h-4 w-4" />
                          Attio
                        </Button>
                      </a>
                    )}
                    <Button size="sm" onClick={() => handleOpenInEmail(draft)}>
                      <Send className="h-4 w-4" />
                      Open in Email
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

      {/* Edit draft modal */}
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
                <Button
                  onClick={() => {
                    handleSaveEdit();
                    if (editingDraft) handleOpenInEmail(editingDraft);
                  }}
                >
                  <CheckCircle className="h-4 w-4" />
                  Save &amp; Open in Email
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
