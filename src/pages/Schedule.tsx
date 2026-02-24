import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6 AM to 9 PM

interface ScheduleBlock {
  id: string;
  subject_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface Subject {
  id: string;
  name: string;
  color: string;
}

const Schedule = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [subjectId, setSubjectId] = useState<string>("none");

  const fetchData = async () => {
    if (!user) return;
    const [blocksRes, subjectsRes] = await Promise.all([
      supabase.from("schedule_blocks").select("*").eq("user_id", user.id),
      supabase.from("subjects").select("id, name, color").eq("user_id", user.id),
    ]);
    setBlocks(blocksRes.data || []);
    setSubjects(subjectsRes.data || []);
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("schedule_blocks").insert({
      user_id: user.id,
      subject_id: subjectId === "none" ? null : subjectId,
      day_of_week: parseInt(dayOfWeek),
      start_time: startTime,
      end_time: endTime,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setDialogOpen(false);
    fetchData();
    toast({ title: "Block added" });
  };

  const deleteBlock = async (id: string) => {
    await supabase.from("schedule_blocks").delete().eq("id", id);
    fetchData();
  };

  const getSubject = (id: string | null) => subjects.find((s) => s.id === id);

  const getBlocksForDayAndHour = (day: number, hour: number) => {
    return blocks.filter((b) => {
      const startHour = parseInt(b.start_time.split(":")[0]);
      const endHour = parseInt(b.end_time.split(":")[0]);
      return b.day_of_week === day && hour >= startHour && hour < endHour;
    });
  };

  const isBlockStart = (block: ScheduleBlock, hour: number) => {
    return parseInt(block.start_time.split(":")[0]) === hour;
  };

  const getBlockSpan = (block: ScheduleBlock) => {
    const start = parseInt(block.start_time.split(":")[0]);
    const end = parseInt(block.end_time.split(":")[0]);
    return end - start;
  };

  // Track rendered blocks to avoid duplicates
  const rendered = new Set<string>();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
          <p className="text-muted-foreground">Plan your weekly study blocks</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Block</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Study Block</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS.map((d, i) => <SelectItem key={i} value={i.toString()}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Start</label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">End</label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No subject</SelectItem>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="submit" className="w-full">Add Block</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-8 gap-px rounded-lg border border-border/50 bg-border/30 overflow-hidden">
            {/* Header */}
            <div className="bg-card p-2 text-xs font-medium text-muted-foreground" />
            {DAYS.map((day, i) => (
              <div key={i} className="bg-card p-2 text-center text-xs font-medium text-muted-foreground">
                {day.slice(0, 3)}
              </div>
            ))}

            {/* Time slots */}
            {HOURS.map((hour) => (
              <>
                <div key={`time-${hour}`} className="bg-card/60 p-2 text-right text-xs text-muted-foreground">
                  {hour.toString().padStart(2, "0")}:00
                </div>
                {DAYS.map((_, dayIdx) => {
                  const dayBlocks = getBlocksForDayAndHour(dayIdx, hour);
                  const startingBlock = dayBlocks.find(b => isBlockStart(b, hour));

                  if (startingBlock && !rendered.has(startingBlock.id)) {
                    rendered.add(startingBlock.id);
                    const subject = getSubject(startingBlock.subject_id);
                    return (
                      <div key={`${dayIdx}-${hour}`} className="relative bg-card/40 p-0.5">
                        <div
                          className="group absolute inset-0.5 z-10 flex items-start justify-between rounded-md p-1.5 text-xs font-medium text-white"
                          style={{
                            backgroundColor: subject?.color || "hsl(262, 83%, 58%)",
                            height: `calc(${getBlockSpan(startingBlock) * 100}% + ${(getBlockSpan(startingBlock) - 1)}px)`,
                          }}
                        >
                          <span className="truncate">{subject?.name || "Study"}</span>
                          <button
                            onClick={() => deleteBlock(startingBlock.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  }

                  if (dayBlocks.length > 0 && !startingBlock) {
                    return <div key={`${dayIdx}-${hour}`} className="bg-card/40" />;
                  }

                  return <div key={`${dayIdx}-${hour}`} className="bg-card/40" />;
                })}
              </>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Schedule;
