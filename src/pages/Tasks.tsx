import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, AlertTriangle, Filter } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, isPast, isToday } from "date-fns";

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  subject_id: string | null;
  completed_at: string | null;
}

interface Subject {
  id: string;
  name: string;
  color: string;
}

const priorityColors: Record<string, string> = {
  high: "bg-destructive/20 text-destructive border-destructive/30",
  medium: "bg-warning/20 text-warning border-warning/30",
  low: "bg-success/20 text-success border-success/30",
};

const Tasks = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("due_date");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [subjectId, setSubjectId] = useState<string>("none");

  const fetchData = async () => {
    if (!user) return;
    const [tasksRes, subjectsRes] = await Promise.all([
      supabase.from("tasks").select("*").eq("user_id", user.id),
      supabase.from("subjects").select("id, name, color").eq("user_id", user.id),
    ]);
    setTasks(tasksRes.data || []);
    setSubjects(subjectsRes.data || []);
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("tasks").insert({
      title,
      description: description || null,
      due_date: dueDate || null,
      priority,
      subject_id: subjectId === "none" ? null : subjectId,
      user_id: user.id,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setDialogOpen(false);
    setTitle(""); setDescription(""); setDueDate(""); setPriority("medium"); setSubjectId("none");
    fetchData();
    toast({ title: "Task created" });
  };

  const toggleComplete = async (task: Task) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    await supabase.from("tasks").update({
      status: newStatus,
      completed_at: newStatus === "completed" ? new Date().toISOString() : null,
    }).eq("id", task.id);
    fetchData();
  };

  const deleteTask = async (id: string) => {
    await supabase.from("tasks").delete().eq("id", id);
    fetchData();
    toast({ title: "Task deleted" });
  };

  const getSubject = (id: string | null) => subjects.find((s) => s.id === id);

  const filtered = tasks
    .filter((t) => filterSubject === "all" || t.subject_id === filterSubject)
    .filter((t) => filterStatus === "all" || t.status === filterStatus)
    .sort((a, b) => {
      if (sortBy === "due_date") {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      if (sortBy === "priority") {
        const order = { high: 0, medium: 1, low: 2 };
        return (order[a.priority as keyof typeof order] ?? 1) - (order[b.priority as keyof typeof order] ?? 1);
      }
      return 0;
    });

  const isOverdue = (task: Task) =>
    task.status === "pending" && task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">Track your assignments and to-dos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Task</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <Input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              <div className="grid grid-cols-2 gap-4">
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={subjectId} onValueChange={setSubjectId}>
                  <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No subject</SelectItem>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">Create Task</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><Filter className="mr-2 h-3 w-3" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterSubject} onValueChange={setFilterSubject}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subjects</SelectItem>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="due_date">By due date</SelectItem>
            <SelectItem value="priority">By priority</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Task List */}
      <div className="space-y-2">
        <AnimatePresence>
          {filtered.map((task) => {
            const subject = getSubject(task.subject_id);
            const overdue = isOverdue(task);
            return (
              <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} layout>
                <Card className={`border-border/50 bg-card/80 transition-colors ${overdue ? "border-destructive/40" : ""}`}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <Checkbox
                      checked={task.status === "completed"}
                      onCheckedChange={() => toggleComplete(task)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium truncate ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                          {task.title}
                        </p>
                        {overdue && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {subject && (
                          <div className="flex items-center gap-1">
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: subject.color }} />
                            <span className="text-xs text-muted-foreground">{subject.name}</span>
                          </div>
                        )}
                        {task.due_date && (
                          <span className={`text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                            Due {format(new Date(task.due_date), "MMM d")}
                          </span>
                        )}
                        <Badge variant="outline" className={`text-xs ${priorityColors[task.priority]}`}>
                          {task.priority}
                        </Badge>
                      </div>
                    </div>
                    <button onClick={() => deleteTask(task.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive/20 hover:text-destructive shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <Card className="border-dashed border-border/50 bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">No tasks found. Click "Add Task" to create one.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Tasks;
