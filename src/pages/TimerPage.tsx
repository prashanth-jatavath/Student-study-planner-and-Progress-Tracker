import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Play, Pause, RotateCcw, Coffee } from "lucide-react";
import { motion } from "framer-motion";

interface Subject {
  id: string;
  name: string;
  color: string;
}

type TimerPhase = "work" | "break";

const TimerPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState<string>("none");
  const [workMinutes, setWorkMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState<TimerPhase>("work");
  const [sessionsCompleted, setSessions] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("subjects").select("id, name, color").eq("user_id", user.id).then(({ data }) => {
      setSubjects(data || []);
    });
  }, [user]);

  const logSession = useCallback(async () => {
    if (!user) return;
    await supabase.from("study_sessions").insert({
      user_id: user.id,
      subject_id: subjectId === "none" ? null : subjectId,
      duration_minutes: workMinutes,
      started_at: new Date(Date.now() - workMinutes * 60 * 1000).toISOString(),
    });
  }, [user, subjectId, workMinutes]);

  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          if (phase === "work") {
            logSession();
            setSessions((s) => s + 1);
            toast({ title: "🎉 Session complete!", description: "Time for a break." });
            setPhase("break");
            setIsRunning(false);
            return breakMinutes * 60;
          } else {
            toast({ title: "Break's over!", description: "Ready for another session?" });
            setPhase("work");
            setIsRunning(false);
            return workMinutes * 60;
          }
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, phase, workMinutes, breakMinutes, logSession, toast]);

  const toggle = () => setIsRunning(!isRunning);

  const reset = () => {
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setPhase("work");
    setTimeLeft(workMinutes * 60);
  };

  const applySettings = () => {
    if (!isRunning) {
      setTimeLeft(phase === "work" ? workMinutes * 60 : breakMinutes * 60);
    }
  };

  useEffect(() => { applySettings(); }, [workMinutes, breakMinutes]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const totalSeconds = phase === "work" ? workMinutes * 60 : breakMinutes * 60;
  const progress = ((totalSeconds - timeLeft) / totalSeconds) * 100;
  const subject = subjects.find((s) => s.id === subjectId);

  const circumference = 2 * Math.PI * 120;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pomodoro Timer</h1>
        <p className="text-muted-foreground">Focus on your studies with timed sessions</p>
      </div>

      <div className="mx-auto max-w-md space-y-8">
        {/* Timer Circle */}
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <svg width="280" height="280" className="-rotate-90">
              <circle cx="140" cy="140" r="120" fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
              <motion.circle
                cx="140" cy="140" r="120" fill="none"
                stroke={phase === "work" ? (subject?.color || "hsl(262, 83%, 58%)") : "hsl(173, 80%, 40%)"}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                initial={false}
                animate={{ strokeDashoffset }}
                transition={{ duration: 0.5 }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {phase === "work" ? (subject?.name || "Focus") : "Break"}
              </span>
              <span className="text-5xl font-bold tabular-nums" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {minutes.toString().padStart(2, "0")}:{seconds.toString().padStart(2, "0")}
              </span>
              {phase === "break" && <Coffee className="mt-2 h-5 w-5 text-muted-foreground" />}
            </div>
          </div>

          <div className="flex gap-3">
            <Button size="lg" onClick={toggle} className="w-32">
              {isRunning ? <><Pause className="mr-2 h-4 w-4" /> Pause</> : <><Play className="mr-2 h-4 w-4" /> Start</>}
            </Button>
            <Button size="lg" variant="outline" onClick={reset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">Sessions completed: <span className="font-semibold text-foreground">{sessionsCompleted}</span></p>
        </div>

        {/* Settings */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader><CardTitle className="text-base">Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger><SelectValue placeholder="Link to subject" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No subject</SelectItem>
                {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Work (min)</label>
                <Input type="number" value={workMinutes} onChange={(e) => setWorkMinutes(Number(e.target.value))} min={1} max={120} disabled={isRunning} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Break (min)</label>
                <Input type="number" value={breakMinutes} onChange={(e) => setBreakMinutes(Number(e.target.value))} min={1} max={30} disabled={isRunning} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TimerPage;
