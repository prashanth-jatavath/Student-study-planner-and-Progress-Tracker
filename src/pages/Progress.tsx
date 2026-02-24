import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { motion } from "framer-motion";
import { differenceInCalendarDays, subDays, format, startOfDay } from "date-fns";

interface Subject { id: string; name: string; color: string; }
interface StudySession { id: string; subject_id: string | null; duration_minutes: number; started_at: string; }
interface Task { id: string; status: string; completed_at: string | null; }

const Progress = () => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [subRes, sesRes, taskRes] = await Promise.all([
        supabase.from("subjects").select("id, name, color").eq("user_id", user.id),
        supabase.from("study_sessions").select("*").eq("user_id", user.id).order("started_at", { ascending: false }),
        supabase.from("tasks").select("id, status, completed_at").eq("user_id", user.id),
      ]);
      setSubjects(subRes.data || []);
      setSessions(sesRes.data || []);
      setTasks(taskRes.data || []);

      // Calculate streak
      const allSessions = sesRes.data || [];
      const sessionDays = new Set(allSessions.map(s => format(new Date(s.started_at), "yyyy-MM-dd")));
      let currentStreak = 0;
      let day = startOfDay(new Date());
      while (sessionDays.has(format(day, "yyyy-MM-dd"))) {
        currentStreak++;
        day = subDays(day, 1);
      }
      setStreak(currentStreak);
    };
    fetch();
  }, [user]);

  // Hours per subject
  const hoursPerSubject = subjects.map((s) => {
    const totalMins = sessions.filter(se => se.subject_id === s.id).reduce((a, se) => a + se.duration_minutes, 0);
    return { name: s.name, hours: Math.round(totalMins / 6) / 10, color: s.color };
  }).filter(d => d.hours > 0);

  // Daily study hours for last 7 days
  const dailyData = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dateStr = format(date, "yyyy-MM-dd");
    const mins = sessions
      .filter(s => format(new Date(s.started_at), "yyyy-MM-dd") === dateStr)
      .reduce((a, s) => a + s.duration_minutes, 0);
    return { day: format(date, "EEE"), hours: Math.round(mins / 6) / 10 };
  });

  // Task completion
  const completed = tasks.filter(t => t.status === "completed").length;
  const pending = tasks.filter(t => t.status === "pending").length;
  const taskData = [
    { name: "Completed", value: completed, color: "hsl(142, 76%, 36%)" },
    { name: "Pending", value: pending, color: "hsl(240, 6%, 16%)" },
  ].filter(d => d.value > 0);

  const totalHours = Math.round(sessions.reduce((a, s) => a + s.duration_minutes, 0) / 6) / 10;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Progress</h1>
        <p className="text-muted-foreground">Track your study performance and trends</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total Hours", value: totalHours, emoji: "📚" },
          { label: "Study Streak", value: `${streak} day${streak !== 1 ? "s" : ""}`, emoji: "🔥" },
          { label: "Tasks Done", value: `${completed}/${completed + pending}`, emoji: "✅" },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className="border-border/50 bg-card/80">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="text-2xl">{card.emoji}</span>
                <div>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className="text-xl font-bold">{card.value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily study hours */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader><CardTitle className="text-base">Daily Study Hours (Last 7 Days)</CardTitle></CardHeader>
          <CardContent>
            {dailyData.some(d => d.hours > 0) ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyData}>
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(240, 10%, 6%)", border: "1px solid hsl(240, 6%, 16%)", borderRadius: 8 }} />
                  <Bar dataKey="hours" fill="hsl(262, 83%, 58%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">No study sessions yet</p>
            )}
          </CardContent>
        </Card>

        {/* Hours per subject */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader><CardTitle className="text-base">Hours per Subject</CardTitle></CardHeader>
          <CardContent>
            {hoursPerSubject.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={hoursPerSubject} layout="vertical">
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={80} />
                  <Tooltip contentStyle={{ background: "hsl(240, 10%, 6%)", border: "1px solid hsl(240, 6%, 16%)", borderRadius: 8 }} />
                  <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
                    {hoursPerSubject.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">No data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Task completion */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader><CardTitle className="text-base">Task Completion</CardTitle></CardHeader>
          <CardContent>
            {taskData.length > 0 ? (
              <div className="flex items-center justify-center">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie data={taskData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" strokeWidth={0}>
                      {taskData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(240, 10%, 6%)", border: "1px solid hsl(240, 6%, 16%)", borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {taskData.map(d => (
                    <div key={d.name} className="flex items-center gap-2 text-sm">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                      <span>{d.name}: {d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">No tasks yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Progress;
