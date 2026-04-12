"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Send,
  Mail,
  Edit3,
  Trash2,
  CheckCircle,
  Loader2,
  Sparkles,
} from "lucide-react";

interface Draft {
  id: string;
  to: string;
  subject: string;
  body: string;
  status: "generated" | "edited";
}

function buildMailto(to: string, subject: string, body: string): string {
  const subjectEncoded = encodeURIComponent(subject);
  const bodyEncoded = encodeURIComponent(body);
  return `mailto:${encodeURIComponent(to)}?subject=${subjectEncoded}&body=${bodyEncoded}`;
}

export default function Dashboard() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);
  const [formData, setFormData] = useState({
    prospectName: "",
    prospectCompany: "",
    propertyInterest: "",
    additionalContext: "",
  });

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Generation failed");

      const newDrafts: Draft[] = data.drafts.map(
        (
          draft: { to: string; subject: string; body: string },
          i: number
        ) => ({
          id: `draft-${Date.now()}-${i}`,
          to: draft.to || `${formData.prospectName} <${formData.prospectName.toLowerCase().replace(" ", ".")}@company.com>`,
          subject: draft.subject,
          body: draft.body,
          status: "generated" as const,
        })
      );

      setDrafts(newDrafts);
      toast.success(`${newDrafts.length} drafts generated`, { description: "Review below and open in your email client to send." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate";
      toast.error("Error", { description: msg });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenInEmail = (draft: Draft) => {
    window.location.href = buildMailto(draft.to, draft.subject, draft.body);
    toast(`Opening email client for ${draft.to}`);
  };

  const handleEditDraft = (draft: Draft) => {
    setEditingDraft({ ...draft });
  };

  const handleSaveEdit = () => {
    if (editingDraft) {
      setDrafts((prev) =>
        prev.map((d) =>
          d.id === editingDraft.id ? { ...editingDraft, status: "edited" as const } : d
        )
      );
      setEditingDraft(null);
      toast.success("Draft updated");
    }
  };

  const handleDeleteDraft = (draftId: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== draftId));
    toast.success("Draft deleted");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center gap-3">
          <div className="rounded-full bg-blue-100 p-2">
            <Mail className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="font-semibold text-lg">Email Draft Generator</h1>
            <p className="text-sm text-muted-foreground">Olagunjua Real Estate · Cresa</p>
          </div>
          <div className="ml-auto">
            <Badge variant="outline">{drafts.length} drafts</Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        {/* Generate Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              Generate Email Drafts
            </CardTitle>
            <CardDescription>
              Enter prospect details and our AI will generate personalized cold email drafts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prospectName">Prospect Name *</Label>
                  <Input
                    id="prospectName"
                    value={formData.prospectName}
                    onChange={(e) =>
                      setFormData({ ...formData, prospectName: e.target.value })
                    }
                    placeholder="John Smith"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prospectCompany">Company *</Label>
                  <Input
                    id="prospectCompany"
                    value={formData.prospectCompany}
                    onChange={(e) =>
                      setFormData({ ...formData, prospectCompany: e.target.value })
                    }
                    placeholder="Acme Corp"
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="propertyInterest">Property Interest</Label>
                  <Input
                    id="propertyInterest"
                    value={formData.propertyInterest}
                    onChange={(e) =>
                      setFormData({ ...formData, propertyInterest: e.target.value })
                    }
                    placeholder="Downtown Calgary office space, 5,000 sq ft"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="additionalContext">Additional Context</Label>
                  <Textarea
                    id="additionalContext"
                    value={formData.additionalContext}
                    onChange={(e) =>
                      setFormData({ ...formData, additionalContext: e.target.value })
                    }
                    placeholder="Any specific details about the prospect, their needs, or what you want to emphasize…"
                    rows={3}
                  />
                </div>
              </div>
              <Button type="submit" disabled={isGenerating} className="w-full md:w-auto">
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Drafts
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Drafts */}
        {drafts.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Generated Drafts</h2>
            {drafts.map((draft) => (
              <Card key={draft.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={draft.status === "edited" ? "secondary" : "default"}>
                          {draft.status === "edited" ? "Edited" : "Generated"}
                        </Badge>
                      </div>
                      <CardTitle className="text-base">{draft.subject}</CardTitle>
                      <CardDescription className="truncate">To: {draft.to}</CardDescription>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditDraft(draft)}
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button size="sm" onClick={() => handleOpenInEmail(draft)}>
                        <Send className="h-4 w-4" />
                        Open in Email
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteDraft(draft.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground bg-slate-100 rounded-md p-3">
                    {draft.body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Edit Modal */}
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
                  onChange={(e) =>
                    setEditingDraft({ ...editingDraft, to: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={editingDraft.subject}
                  onChange={(e) =>
                    setEditingDraft({ ...editingDraft, subject: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Body</Label>
                <Textarea
                  value={editingDraft.body}
                  onChange={(e) =>
                    setEditingDraft({ ...editingDraft, body: e.target.value })
                  }
                  rows={10}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setEditingDraft(null)}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit}>
                  <CheckCircle className="h-4 w-4" />
                  Save &amp; Open in Email
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
