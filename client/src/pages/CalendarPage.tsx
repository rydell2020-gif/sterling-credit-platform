import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { CalendarEvent, Dispute } from "@shared/schema";
import {
  ChevronLeft, ChevronRight, Plus, CalendarDays, Trash2, Clock,
} from "lucide-react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths,
  addDays, format, isSameMonth, isSameDay, parseISO, isAfter, startOfDay,
} from "date-fns";

const COLOR_STYLES: Record<string, { dot: string; bg: string; text: string; border: string; label: string }> = {
  red: { dot: "bg-red-500", bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", label: "FCRA 30-day" },
  gold: { dot: "bg-primary", bg: "bg-primary/10", text: "text-primary", border: "border-primary/30", label: "FCRA 15-day ext." },
  green: { dot: "bg-green-500", bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/30", label: "Follow-up" },
  blue: { dot: "bg-blue-500", bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30", label: "Custom" },
};

const EVENT_TYPES = [
  { value: "fcra_30_day", label: "FCRA 30-day deadline", color: "red" },
  { value: "fcra_15_day_extension", label: "FCRA 15-day extension", color: "gold" },
  { value: "followup", label: "Follow-up", color: "green" },
  { value: "custom", label: "Custom", color: "blue" },
];

function colorFor(e: CalendarEvent): string {
  return e.colorTag && COLOR_STYLES[e.colorTag] ? e.colorTag : "blue";
}

interface EventForm {
  id?: string;
  title: string;
  eventDate: string;
  eventType: string;
  colorTag: string;
  notes: string;
  disputeId: string;
}

const emptyForm = (date?: string): EventForm => ({
  title: "",
  eventDate: date || new Date().toISOString().slice(0, 10),
  eventType: "custom",
  colorTag: "blue",
  notes: "",
  disputeId: "none",
});

export default function CalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cursor, setCursor] = useState(new Date());
  const [dayDialogDate, setDayDialogDate] = useState<Date | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<EventForm>(emptyForm());

  const { data: events = [] } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/calendar");
      return res.json();
    },
    enabled: !!user,
  });

  const { data: disputes = [] } = useQuery<Dispute[]>({
    queryKey: ["/api/disputes", user?.id],
    enabled: !!user,
  });

  const saveMut = useMutation({
    mutationFn: async (f: EventForm) => {
      const payload = {
        userId: user?.id,
        title: f.title,
        eventDate: f.eventDate,
        eventType: f.eventType,
        colorTag: f.colorTag,
        notes: f.notes || null,
        disputeId: f.disputeId === "none" ? null : f.disputeId,
        createdBy: user?.id,
      };
      if (f.id) {
        const res = await apiRequest("PATCH", `/api/calendar/${f.id}`, payload);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/calendar", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar", user?.id] });
      setEditOpen(false);
      toast({ title: "Saved", description: "Calendar event saved." });
    },
    onError: () => toast({ title: "Error", description: "Could not save event.", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/calendar/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar", user?.id] });
      toast({ title: "Deleted", description: "Event removed." });
    },
  });

  // Build calendar grid
  const gridDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor));
    const end = endOfWeek(endOfMonth(cursor));
    const days: Date[] = [];
    let d = start;
    while (d <= end) {
      days.push(d);
      d = addDays(d, 1);
    }
    return days;
  }, [cursor]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach((e) => {
      const k = e.eventDate;
      if (!map[k]) map[k] = [];
      map[k].push(e);
    });
    return map;
  }, [events]);

  const upcoming = useMemo(() => {
    const today = startOfDay(new Date());
    return events
      .filter((e) => {
        try { return isAfter(parseISO(e.eventDate), today) || isSameDay(parseISO(e.eventDate), today); }
        catch { return false; }
      })
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
      .slice(0, 5);
  }, [events]);

  const openNewEvent = (dateStr?: string) => {
    setForm(emptyForm(dateStr));
    setEditOpen(true);
  };
  const openEditEvent = (e: CalendarEvent) => {
    setForm({
      id: e.id,
      title: e.title,
      eventDate: e.eventDate,
      eventType: e.eventType,
      colorTag: colorFor(e),
      notes: e.notes || "",
      disputeId: e.disputeId || "none",
    });
    setEditOpen(true);
  };

  const dayEvents = dayDialogDate ? (eventsByDay[format(dayDialogDate, "yyyy-MM-dd")] || []) : [];

  return (
    <AppLayout>
      <div data-testid="page-calendar">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-serif">Compliance Calendar</h1>
          </div>
          <p className="text-muted-foreground">FCRA dispute deadlines and follow-ups.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Calendar grid */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-serif text-xl">{format(cursor, "MMMM yyyy")}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" data-testid="button-prev-month" onClick={() => setCursor(subMonths(cursor, 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" data-testid="button-today" onClick={() => setCursor(new Date())}>Today</Button>
                    <Button variant="outline" size="icon" data-testid="button-next-month" onClick={() => setCursor(addMonths(cursor, 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button size="sm" data-testid="button-add-event" onClick={() => openNewEvent()}>
                      <Plus className="h-4 w-4 mr-1" /> Add Event
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
                  ))}
                </div>
                {/* Day cells */}
                <div className="grid grid-cols-7 gap-1">
                  {gridDays.map((day) => {
                    const key = format(day, "yyyy-MM-dd");
                    const inMonth = isSameMonth(day, cursor);
                    const isToday = isSameDay(day, new Date());
                    const dEvents = eventsByDay[key] || [];
                    return (
                      <button
                        key={key}
                        data-testid={`day-${key}`}
                        onClick={() => setDayDialogDate(day)}
                        className={`min-h-[92px] p-1.5 rounded-lg border text-left transition-colors flex flex-col gap-1 ${
                          inMonth ? "border-border bg-card hover:bg-muted/30" : "border-transparent bg-muted/10 text-muted-foreground/40"
                        } ${isToday ? "ring-1 ring-primary" : ""}`}
                      >
                        <span className={`text-xs font-medium ${isToday ? "text-primary" : ""}`}>{format(day, "d")}</span>
                        <div className="flex flex-col gap-1 overflow-hidden">
                          {dEvents.slice(0, 3).map((e) => {
                            const c = COLOR_STYLES[colorFor(e)];
                            return (
                              <div key={e.id} className={`flex items-center gap-1 px-1 py-0.5 rounded ${c.bg}`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
                                <span className={`text-[10px] truncate ${c.text}`}>{e.title}</span>
                              </div>
                            );
                          })}
                          {dEvents.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">+{dEvents.length - 3} more</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-border">
                  {Object.entries(COLOR_STYLES).map(([k, c]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                      <span className="text-xs text-muted-foreground">{c.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Upcoming events */}
          <div>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" /> Upcoming Events
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {upcoming.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center" data-testid="empty-upcoming">No upcoming events.</p>
                ) : (
                  upcoming.map((e) => {
                    const c = COLOR_STYLES[colorFor(e)];
                    return (
                      <div
                        key={e.id}
                        data-testid={`upcoming-event-${e.id}`}
                        className={`p-3 rounded-lg border ${c.border} ${c.bg} cursor-pointer`}
                        onClick={() => openEditEvent(e)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                          <span className="text-sm font-medium truncate">{e.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(e.eventDate), "EEE, MMM d, yyyy")}
                        </p>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Day detail dialog */}
        <Dialog open={!!dayDialogDate} onOpenChange={(o) => !o && setDayDialogDate(null)}>
          <DialogContent data-testid="dialog-day">
            <DialogHeader>
              <DialogTitle className="font-serif">
                {dayDialogDate && format(dayDialogDate, "EEEE, MMMM d, yyyy")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {dayEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No events on this day.</p>
              ) : (
                dayEvents.map((e) => {
                  const c = COLOR_STYLES[colorFor(e)];
                  return (
                    <div key={e.id} className={`p-3 rounded-lg border ${c.border} ${c.bg}`} data-testid={`day-event-${e.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                            <span className="text-sm font-medium">{e.title}</span>
                          </div>
                          {e.notes && <p className="text-xs text-muted-foreground mt-1">{e.notes}</p>}
                          <Badge variant="outline" className={`text-xs mt-2 ${c.text} ${c.border}`}>{c.label}</Badge>
                        </div>
                        <div className="flex gap-1">
                          <button
                            data-testid={`button-edit-event-${e.id}`}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                            onClick={() => { setDayDialogDate(null); openEditEvent(e); }}
                            title="Edit"
                          >
                            <CalendarDays className="h-3.5 w-3.5" />
                          </button>
                          <button
                            data-testid={`button-delete-event-${e.id}`}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => deleteMut.mutate(e.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <DialogFooter>
              <Button
                data-testid="button-add-event-for-day"
                onClick={() => {
                  const d = dayDialogDate ? format(dayDialogDate, "yyyy-MM-dd") : undefined;
                  setDayDialogDate(null);
                  openNewEvent(d);
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> Add Event
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add/Edit event modal */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent data-testid="dialog-event-edit">
            <DialogHeader>
              <DialogTitle className="font-serif">{form.id ? "Edit Event" : "New Event"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ev-title" className="text-xs">Title</Label>
                <Input id="ev-title" data-testid="input-event-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Event title" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-date" className="text-xs">Date</Label>
                <Input id="ev-date" data-testid="input-event-date" type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={form.eventType}
                    onValueChange={(v) => {
                      const t = EVENT_TYPES.find((x) => x.value === v);
                      setForm({ ...form, eventType: v, colorTag: t?.color || form.colorTag });
                    }}
                  >
                    <SelectTrigger data-testid="select-event-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Color</Label>
                  <Select value={form.colorTag} onValueChange={(v) => setForm({ ...form, colorTag: v })}>
                    <SelectTrigger data-testid="select-event-color"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(COLOR_STYLES).map((c) => (
                        <SelectItem key={c} value={c}>
                          <span className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${COLOR_STYLES[c].dot}`} />
                            <span className="capitalize">{c}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Link to Dispute (optional)</Label>
                <Select value={form.disputeId} onValueChange={(v) => setForm({ ...form, disputeId: v })}>
                  <SelectTrigger data-testid="select-event-dispute"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {disputes.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.creditorName || d.letterSubject || d.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-notes" className="text-xs">Notes</Label>
                <Textarea id="ev-notes" data-testid="input-event-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" data-testid="button-cancel-event" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button
                data-testid="button-save-event"
                disabled={!form.title || !form.eventDate || saveMut.isPending}
                onClick={() => saveMut.mutate(form)}
              >
                {saveMut.isPending ? "Saving…" : "Save Event"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
