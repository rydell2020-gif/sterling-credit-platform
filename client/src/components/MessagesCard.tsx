import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Paperclip, FileText } from "lucide-react";
import type { Message } from "@shared/schema";

interface MessagesResponse {
  messages: Message[];
  unread: number;
}

export function MessagesCard() {
  const { user } = useAuth();
  const clientId = user?.id || "";
  const [body, setBody] = useState("");
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data } = useQuery<MessagesResponse>({
    queryKey: ["/api/messages", clientId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/messages/${clientId}?forRole=user`);
      return res.json();
    },
    enabled: !!clientId,
    refetchInterval: 5000,
  });

  const readMut = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/messages/${clientId}/read`, { forRole: "user" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/messages", clientId] }),
  });

  // Mark read on mount
  useEffect(() => {
    if (clientId) readMut.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const sendMut = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/messages", {
        clientId,
        senderId: user?.id,
        senderRole: "user",
        body,
        attachmentName: attachmentName,
        attachmentUrl: attachmentName ? "#" : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", clientId] });
      setBody("");
      setAttachmentName(null);
    },
  });

  const messages = data?.messages || [];
  const unread = data?.unread || 0;
  const last5 = messages.slice(-5);

  return (
    <Card className="mb-8" data-testid="card-messages">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Messages from your credit advisor
          </CardTitle>
          {unread > 0 && (
            <Badge className="bg-primary text-primary-foreground text-xs" data-testid="badge-unread">
              {unread} new
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64 pr-3 mb-4" data-testid="messages-thread">
          <div className="space-y-3">
            {last5.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No messages yet.</p>
            ) : (
              last5.map((m) => {
                const isAdmin = m.senderRole === "admin";
                return (
                  <div
                    key={m.id}
                    data-testid={`message-${m.id}`}
                    className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}
                  >
                    <div className={`max-w-[80%] ${isAdmin ? "" : "text-right"}`}>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {isAdmin ? "Advisor" : "You"}
                      </span>
                      <div
                        className={`mt-1 p-3 rounded-lg text-sm ${
                          isAdmin
                            ? "bg-primary/5 border-l-2 border-primary text-foreground rounded-l-none text-left"
                            : "bg-muted text-foreground rounded-r-none text-left"
                        }`}
                      >
                        {m.body}
                        {m.attachmentName && (
                          <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-background/60 border border-border text-xs">
                            <FileText className="h-3 w-3 text-primary" />
                            <span className="truncate max-w-[160px]">{m.attachmentName}</span>
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-0.5 block">
                        {m.createdAt ? new Date(m.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Compose */}
        <div className="border-t border-border pt-4">
          {attachmentName && (
            <div className="mb-2 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-muted border border-border text-xs">
              <FileText className="h-3 w-3 text-primary" />
              <span>{attachmentName}</span>
              <button onClick={() => setAttachmentName(null)} className="text-muted-foreground hover:text-destructive ml-1" data-testid="button-remove-attachment">×</button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              data-testid="input-message"
              placeholder="Type a message to your advisor…"
              rows={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="resize-none"
            />
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setAttachmentName(f.name);
              }}
            />
            <Button
              variant="outline"
              size="icon"
              data-testid="button-attach"
              onClick={() => fileRef.current?.click()}
              title="Attach file"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              data-testid="button-send-message"
              disabled={(!body.trim() && !attachmentName) || sendMut.isPending}
              onClick={() => sendMut.mutate()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
