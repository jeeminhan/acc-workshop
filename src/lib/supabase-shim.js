// Supabase-backed window.storage shim.
// Implements the same get/set/subscribe surface as storage-shim.js but routes
// through a Supabase Postgres table with realtime change events. Multiple
// "rooms" can coexist (different workshops) — the room is read from
// ?room=<name> in the URL or falls back to "default".
//
// Schema (run in Supabase SQL editor):
//
//   create table public.acc_storage (
//     room text not null,
//     key  text not null,
//     value jsonb,
//     updated_at timestamptz not null default now(),
//     primary key (room, key)
//   );
//
//   alter table public.acc_storage enable row level security;
//
//   create policy "acc anon read"   on public.acc_storage for select using (true);
//   create policy "acc anon insert" on public.acc_storage for insert with check (true);
//   create policy "acc anon update" on public.acc_storage for update using (true) with check (true);
//   create policy "acc anon delete" on public.acc_storage for delete using (true);
//
//   alter publication supabase_realtime add table public.acc_storage;
//
// Public access is intentional: the workshop is anonymous and short-lived.
// If you need to lock it down, add a per-room secret column and a policy that
// checks it.

import { createClient } from "@supabase/supabase-js";

function readRoomFromUrl() {
  if (typeof window === "undefined") return "default";
  const params = new URLSearchParams(window.location.search);
  return params.get("room") || "default";
}

export function installSupabaseStorage({ url, anonKey, room }) {
  if (typeof window === "undefined" || window.storage) return;
  const _room = room || readRoomFromUrl();
  const sb = createClient(url, anonKey, {
    realtime: { params: { eventsPerSecond: 20 } },
  });
  const subs = new Set();

  sb.channel(`acc-storage-${_room}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "acc_storage",
        filter: `room=eq.${_room}`,
      },
      (payload) => {
        const key = payload.new?.key || payload.old?.key;
        if (!key) return;
        subs.forEach((fn) => {
          try {
            fn(key);
          } catch {}
        });
      },
    )
    .subscribe();

  window.storage = {
    async get(key) {
      try {
        const { data, error } = await sb
          .from("acc_storage")
          .select("value")
          .eq("room", _room)
          .eq("key", key)
          .maybeSingle();
        if (error) return null;
        return data?.value ?? null;
      } catch {
        return null;
      }
    },
    async set(key, value) {
      try {
        if (value == null) {
          await sb
            .from("acc_storage")
            .delete()
            .eq("room", _room)
            .eq("key", key);
        } else {
          await sb
            .from("acc_storage")
            .upsert(
              { room: _room, key, value, updated_at: new Date().toISOString() },
              { onConflict: "room,key" },
            );
        }
        return true;
      } catch {
        return false;
      }
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };

  window.storage.__room = _room;
  window.storage.__backend = "supabase";
}
