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
import { Plus, Edit3, Copy, Archive, Eye, EyeOff, Loader2 } from "lucide-react";
import { type Template, CATEGORIES, extractVariables, renderTemplate, slugify } from "@/lib/templates";

const CATEGORY_LABELS: Record<string, string> = {
  "cold-outreach": "Cold Outreach",
  "sublease": "Sublease",
  "investment-sales": "Investment Sales",
  "landlord-outreach": "Landlord Outreach",
  "renewals": "Renewals",
};

const PLACEHOLDER_VARS: Record<string, string> = {
  first_name: "Alex",
  company: "Acme Corp",
  building: "123 Main St SW",
  market: "Beltline",
  square_feet: "4,200",
  storeys: "3",
  exterior_offices: "8",
  interior_offices: "12",
  parking: "10 stalls",
  timing: "Q3 2026",
};

const EMPTY_FORM = {
  name: "",
  category: "cold-outreach",
  description: "",
  subject: "",
  body: "",
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [previewing, setPreviewing] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates || []))
      .catch(() => toast.error("Failed to load templates"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = templates.filter((t) => {
    if (!showArchived && t.archived) return false;
    if (filterCategory !== "all" && t.category !== filterCategory) return false;
    return true;
  });

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setIsCreating(true);
  };

  const openEdit = (t: Template) => {
    setForm({ name: t.name, category: t.category, description: t.description, subject: t.subject, body: t.body });
    setEditing(t);
    setIsCreating(true);
  };

  const handleDuplicate = (t: Template) => {
    setForm({
      name: `${t.name} (copy)`,
      category: t.category,
      description: t.description,
      subject: t.subject,
      body: t.body,
    });
    setEditing(null);
    setIsCreating(true);
  };

  const handleArchive = async (t: Template) => {
    if (!confirm(`Archive "${t.name}"? It will be hidden but not deleted.`)) return;
    try {
      const res = await fetch(`/api/templates/${t.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, archived: true } : x)));
      toast.success(`"${t.name}" archived`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to archive");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/templates/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setTemplates((prev) => prev.map((t) => (t.id === editing.id ? data.template : t)));
        toast.success("Template updated — deploying changes…");
      } else {
        const id = slugify(form.name);
        const res = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setTemplates((prev) => [...prev, data.template]);
        toast.success("Template created — deploying changes…");
      }
      setIsCreating(false);
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const detectedVars = extractVariables(form.subject + " " + form.body);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant={filterCategory === "all" ? "default" : "outline"}
            onClick={() => setFilterCategory("all")}
          >
            All
          </Button>
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              size="sm"
              variant={filterCategory === cat ? "default" : "outline"}
              onClick={() => setFilterCategory(cat)}
            >
              {CATEGORY_LABELS[cat]}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowArchived((v) => !v)}
            className="text-muted-foreground"
          >
            {showArchived ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
            {showArchived ? "Hide archived" : "Show archived"}
          </Button>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Template list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading templates…
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">No templates found.</p>
      ) : (
        <div className="grid gap-4">
          {filtered.map((t) => (
            <Card key={t.id} className={t.archived ? "opacity-50" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="outline">{CATEGORY_LABELS[t.category] || t.category}</Badge>
                      {t.archived && <Badge variant="secondary">Archived</Badge>}
                      {t.variables.map((v) => (
                        <Badge key={v} variant="secondary" className="font-mono text-xs">
                          {"{" + v + "}"}
                        </Badge>
                      ))}
                    </div>
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    {t.description && (
                      <CardDescription className="mt-0.5">{t.description}</CardDescription>
                    )}
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      Subject: {t.subject}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => setPreviewing(previewing === t.id ? null : t.id)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(t)} disabled={t.archived}>
                      <Edit3 className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDuplicate(t)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    {!t.archived && (
                      <Button size="sm" variant="ghost" onClick={() => handleArchive(t)}>
                        <Archive className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              {previewing === t.id && (
                <CardContent className="pt-0">
                  <div className="bg-slate-50 rounded-md p-4 space-y-2 border">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Preview</p>
                    <p className="text-sm font-medium">
                      Subject: {renderTemplate(t.subject, PLACEHOLDER_VARS)}
                    </p>
                    <pre className="text-sm whitespace-pre-wrap text-muted-foreground">
                      {renderTemplate(t.body, PLACEHOLDER_VARS)}
                    </pre>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>{editing ? `Edit: ${editing.name}` : "New Template"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Furnished Sublease Outreach"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {CATEGORY_LABELS[cat]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description of when to use this template"
                />
              </div>
              <div className="space-y-2">
                <Label>Subject *</Label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Supporting {company} from Cresa"
                />
              </div>
              <div className="space-y-2">
                <Label>Body *</Label>
                <Textarea
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder={"Hi {first_name},\n\n..."}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>

              {detectedVars.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Detected variables</Label>
                  <div className="flex flex-wrap gap-1">
                    {detectedVars.map((v) => (
                      <Badge key={v} variant="secondary" className="font-mono text-xs">
                        {"{" + v + "}"}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Live preview */}
              {form.body && (
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Live preview</Label>
                  <div className="bg-slate-50 rounded-md p-3 border space-y-1">
                    <p className="text-sm font-medium">
                      Subject: {renderTemplate(form.subject, PLACEHOLDER_VARS)}
                    </p>
                    <pre className="text-sm whitespace-pre-wrap text-muted-foreground">
                      {renderTemplate(form.body, PLACEHOLDER_VARS)}
                    </pre>
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={() => { setIsCreating(false); setEditing(null); }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Save Template"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
