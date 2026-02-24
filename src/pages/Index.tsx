import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, ListTodo, Timer, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

interface DashboardStats {
  totalSubjects: number;
  pendingTasks: number;
  studyHoursThisWeek: number;
  completionRate: number;
}

const Index = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalSubjects: 0,
    pendingTasks: 0,
    studyHoursThisWeek: 0,
    completionRate: 0,
  });
  const [subjects, setSubjects] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [subjectsRes, tasksRes, sessionsRes] = await Promise.all([
        supabase.from("subjects").select("*").eq("user_id", user.id),
        supabase.from("tasks").select("*").eq("user_id", user.id),
        supabase.from("study_sessions").select("*").eq("user_id", user.id)
          .gte("started_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const allTasks = tasksRes.data || [];
      const completedTasks = allTasks.filter((t) => t.status === "completed").length;
      const totalMinutes = (sessionsRes.data || []).reduce((acc, s) => acc + s.duration_minutes, 0);

      setSubjects(subjectsRes.data || []);
      setStats({
        totalSubjects: (subjectsRes.data || []).length,
        pendingTasks: allTasks.filter((t) => t.status === "pending").length,
        studyHoursThisWeek: Math.round((totalMinutes / 60) * 10) / 10,
        completionRate: allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0,
      });
    };

    fetchData();
  }, [user]);

  const statCards = [
    { label: "Subjects", value: stats.totalSubjects, icon: BookOpen, color: "text-[hsl(262,83%,58%)]" },
    { label: "Pending Tasks", value: stats.pendingTasks, icon: ListTodo, color: "text-[hsl(35,92%,55%)]" },
    { label: "Hours This Week", value: stats.studyHoursThisWeek, icon: Timer, color: "text-[hsl(173,80%,40%)]" },
    { label: "Completion Rate", value: `${stats.completionRate}%`, icon: TrendingUp, color: "text-[hsl(142,76%,36%)]" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your study overview.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className="border-border/50 bg-card/80">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{card.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {subjects.length > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-semibold">Your Subjects</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subject) => (
              <Card key={subject.id} className="border-border/50 bg-card/80">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: subject.color }} />
                  <div>
                    <p className="font-medium">{subject.name}</p>
                    {subject.grade_goal && (
                      <p className="text-xs text-muted-foreground">Goal: {subject.grade_goal}%</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {subjects.length === 0 && (
        <Card className="border-dashed border-border/50 bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="text-lg font-medium">No subjects yet</h3>
            <p className="text-sm text-muted-foreground">Add your first subject to get started!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Index;
