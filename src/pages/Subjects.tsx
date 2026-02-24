import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#ef4444", "#10b981", "#ec4899", "#8b5cf6", "#06b6d4"];

interface Subject {
  id: string;
  name: string;
  color: string;
  grade_goal: number | null;
}

const Subjects = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [gradeGoal, setGradeGoal] = useState("");

  const fetchSubjects = async () => {
    if (!user) return;
    const { data } = await supabase.from("subjects").select("*").eq("user_id", user.id).order("created_at");
    setSubjects(data || []);
  };

  useEffect(() => { fetchSubjects(); }, [user]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setColor(COLORS[0]);
    setGradeGoal("");
    setDialogOpen(true);
  };

  const openEdit = (s: Subject) => {
    setEditing(s);
    setName(s.name);
    setColor(s.color);
    setGradeGoal(s.grade_goal?.toString() || "");
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const payload = { name, color, grade_goal: gradeGoal ? parseFloat(gradeGoal) : null, user_id: user.id };

    if (editing) {
      const { error } = await supabase.from("subjects").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("subjects").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    }

    setDialogOpen(false);
    fetchSubjects();
    toast({ title: editing ? "Subject updated" : "Subject created" });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    fetchSubjects();
    toast({ title: "Subject deleted" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subjects</h1>
          <p className="text-muted-foreground">Manage your courses and subjects</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add Subject
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Subject" : "New Subject"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <Input placeholder="Subject name" value={name} onChange={(e) => setName(e.target.value)} required />
              <div>
                <label className="mb-2 block text-sm text-muted-foreground">Color</label>
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`h-8 w-8 rounded-full transition-all ${color === c ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <Input
                type="number"
                placeholder="Grade goal (optional, e.g. 85)"
                value={gradeGoal}
                onChange={(e) => setGradeGoal(e.target.value)}
                min={0}
                max={100}
              />
              <Button type="submit" className="w-full">{editing ? "Update" : "Create"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>
          {subjects.map((subject) => (
            <motion.div
              key={subject.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              layout
            >
              <Card className="group border-border/50 bg-card/80 transition-colors hover:border-border">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 rounded-full" style={{ backgroundColor: subject.color }} />
                    <CardTitle className="text-lg">{subject.name}</CardTitle>
                  </div>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button onClick={() => openEdit(subject)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(subject.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive/20 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardHeader>
                {subject.grade_goal && (
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">Grade goal: {subject.grade_goal}%</p>
                  </CardContent>
                )}
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {subjects.length === 0 && (
        <Card className="border-dashed border-border/50 bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">No subjects yet. Click "Add Subject" to create one.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Subjects;
