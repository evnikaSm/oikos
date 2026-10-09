"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import type { OikosState } from "@/lib/oikos";
import { parseInvitationLink, validInviteToken } from "@/lib/invitations";
import OikosApp from "./oikos-app";

type RecordState = { id: string; revision: number; state: OikosState; invite_token: string };

export default function BackendApp() {
    const [demo, setDemo] = useState(false);
    const client = getSupabase();
    if (demo) return <OikosApp />;
    if (!client) return <div className="mx-auto max-w-lg p-5 mt-10"><section className="panel space-y-4"><h1 className="text-2xl font-bold">Połącz swój dom</h1><p>Połączenie z bazą danych nie jest jeszcze skonfigurowane.</p><p>Uzupełnij plik .env.local zgodnie z instrukcją SUPABASE.md i uruchom ponownie aplikację.</p><button className="btn-secondary" onClick={() => setDemo(true)}>Otwórz lokalne demo</button></section></div>;
    return <ConnectedApp client={client} />;
}

function ConnectedApp({ client }: { client: SupabaseClient }) {
    const [session, setSession] = useState<Session | null>(null);
    const [authReady, setAuthReady] = useState(false);
    const [record, setRecord] = useState<RecordState | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [inviteInput, setInviteInput] = useState("");
    const [name, setName] = useState("");
    const [houseName, setHouseName] = useState("");
    const [invite, setInvite] = useState("");
    const lock = useRef(false);
    const requestVersion = useRef(0);
    const userId = session?.user.id;

    useEffect(() => {
        const query = new URLSearchParams(window.location.search).get("invite");
        if (query && validInviteToken(query)) sessionStorage.setItem("oikos-invite", query);
        const timer = setTimeout(() => {
            const saved = sessionStorage.getItem("oikos-invite") ?? "";
            if (query && !validInviteToken(query)) {
                sessionStorage.removeItem("oikos-invite");
                setError("Nieprawidłowy link zaproszenia. Poproś domownika o aktualny link.");
            } else if (validInviteToken(saved)) setInvite(saved);
        }, 0);
        const { data: { subscription } } = client.auth.onAuthStateChange((_event, next) => {
            setSession(next); setAuthReady(true);
        });
        client.auth.getSession().then(({ data, error }) => {
            if (error) setError("Nie udało się odczytać sesji. Spróbuj zalogować się ponownie.");
            setSession(data.session); setAuthReady(true);
        });
        return () => { clearTimeout(timer); subscription.unsubscribe(); };
    }, [client]);

    useEffect(() => {
        if (!notice) return;
        const timer = window.setTimeout(() => setNotice(""), 2500);
        return () => window.clearTimeout(timer);
    }, [notice]);

    const refresh = useCallback(async () => {
        const version = ++requestVersion.current;
        if (!userId) { setRecord(null); setLoaded(true); return; }
        const { data, error } = await client.from("oikos_households").select("id,state,revision,invite_token").maybeSingle();
        if (version !== requestVersion.current) return;
        if (error) throw error;
        setRecord(data as RecordState | null); setLoaded(true);
    }, [client, userId]);

    useEffect(() => {
        let active = true;
        const versions = requestVersion;
        const run = () => { if (!lock.current) void refresh().catch(() => { if (active) setError("Nie można pobrać danych domu. Sprawdź połączenie i konfigurację bazy danych."); }); };
        const timer = setTimeout(run, 0);
        const interval = setInterval(run, 10000);
        window.addEventListener("focus", run);
        return () => { active = false; versions.current++; clearTimeout(timer); clearInterval(interval); window.removeEventListener("focus", run); };
    }, [refresh]);

    const run = async (action: () => Promise<void>) => {
        if (lock.current) return;
        lock.current = true; requestVersion.current++; setBusy(true); setError(""); setNotice("");
        try { await action(); }
        catch (err) {
            const message = err && typeof err === "object" && "message" in err ? String(err.message) : "";
            if (message.includes("OIKOS_SHARED_ROTATION_BLOCKED")) {
                setError("Baza danych zablokowała ponowne rozdzielenie dyżurów. Nowy grafik nie został zapisany. Obsługa wspólnego grafiku wymaga aktualizacji.");
            } else if (message.includes("OIKOS_OWN_CLEANING_ONLY")) {
                setError("Możesz zmieniać i potwierdzać tylko dyżury przypisane do Ciebie. Odśwież grafik i spróbuj ponownie.");
            } else if (message.includes("OIKOS_OWN_EXPENSE_ONLY")) {
                setError("Możesz usuwać i zmieniać tylko własne wydatki. Odśwież historię i spróbuj ponownie.");
            } else if (message.includes("Invalid expense amount")) {
                setError("Podaj kwotę większą od zera, z maksymalnie dwoma miejscami po przecinku.");
            } else if (message.includes("OIKOS_OWN_CONTRIBUTION_ONLY")) {
                setError("Możesz zmieniać tylko własną wpłatę. Kwoty pozostałych domowników są tylko do odczytu.");
            } else if (message.includes("OIKOS_CONFLICT")) {
                setError("Ktoś zmienił dane w międzyczasie. Pobieramy aktualną wersję. Powtórz swoją zmianę.");
                await refresh().catch(() => setError("Nie można pobrać aktualnych danych. Odśwież stronę przed ponownym zapisem."));
            } else setError("Nie udało się wykonać operacji. Sprawdź połączenie i spróbuj ponownie. " + (message.includes("Invalid invitation") ? "Zaproszenie jest nieprawidłowe lub wygasło." : ""));
        } finally { lock.current = false; setBusy(false); }
    };

    const updateState = (updater: (prev: OikosState) => OikosState) => {
        if (!record || !userId) return;
        void run(async () => {
            const next = updater(viewState(record, userId));
            const { activeMemberId: _actor, ...shared } = next;
            void _actor;
            shared.house = record.state.house;
            const { error } = await client.rpc("oikos_save_house", { house_id: record.id, expected_revision: record.revision, next_state: shared });
            if (error) {
                const replannedAnotherMember = next.cleaningAssignments.some(assignment => {
                    const previous = record.state.cleaningAssignments.find(a => a.id === assignment.id);
                    return previous?.status === "pending" && previous.assignedMemberId !== userId
                        && assignment.status === "pending" && !assignment.manualOverride
                        && (previous.assignedMemberId !== assignment.assignedMemberId || previous.manualOverride);
                });
                if (error.message.includes("OIKOS_OWN_CLEANING_ONLY") && replannedAnotherMember) {
                    throw new Error("OIKOS_SHARED_ROTATION_BLOCKED");
                }
                throw error;
            }
            await refresh(); setNotice("Zapisano");
        });
    };

    const clearInvite = () => {
        setInvite(""); setInviteInput(""); setError("");
        sessionStorage.removeItem("oikos-invite");
        window.history.replaceState({}, "", "/");
    };

    const applyInvite = () => {
        const token = parseInvitationLink(inviteInput, window.location.origin);
        if (!token) {
            setError("Wklej pełny link zaproszenia do Oikos z tej strony. Znajdziesz go w zakładce Dom.");
            return null;
        }
        setInvite(token); setInviteInput(""); setError("");
        sessionStorage.setItem("oikos-invite", token);
        window.history.replaceState({}, "", `/?invite=${encodeURIComponent(token)}`);
        return token;
    };

    if (!authReady) return <p role="status" className="p-6">Wczytywanie…</p>;
    if (session && record && record.state.members.some(m => m.id === userId)) return <>
        <div className="mx-auto max-w-[960px] px-3 pt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">{record.state.members.find(m => m.id === userId)?.name}</p>
            <button disabled={busy} className="text-button" onClick={() => void run(async () => { const { error } = await client.auth.signOut(); if (error) throw error; setRecord(null); })}>Wyloguj</button>
        </div>
        {error && <p role="alert" className="notice mx-auto max-w-[936px]">{error}</p>}
        <div role="status" aria-live="polite" className="save-feedback">{(busy || notice) && <span>{busy ? "Zapisywanie…" : notice}</span>}</div>
        {invite && <div className="notice mx-auto max-w-[936px]">
            <p>{invite === record.invite_token ? "Jesteś już w tym domu." : "Należysz już do domu. Jedno konto może należeć do jednego domu — zaproszenie nie zmieni Twojego członkostwa."}</p>
            <button className="text-button" onClick={clearInvite}>Zamknij zaproszenie</button>
        </div>}
        <div inert={busy}><OikosApp key={record.id + userId} remote={{ state: viewState(record, userId!), updateState, removeMember: id => void run(async () => {
            const { error } = await client.rpc("oikos_remove_member", { target_id: id, expected_revision: record.revision });
            if (error) throw error;
            await refresh();
        }) }} /></div>
    </>;

    return <main className="auth-shell"><section className="auth-card space-y-5">
        <p className="eyebrow">Oikos · wspólny dom</p>
        <h1 className="text-3xl font-bold">{session ? "Twój dom" : "Dobrze być u siebie"}</h1>
        <p className="muted">{session ? "Dołącz do domowników lub stwórz nowe miejsce dla Was." : "Zakupy, budżet i sprzątanie — razem, w jednym miejscu."}</p>
        {error && <p role="alert" className="notice">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        <div className="auth-invitation">
            <h2 className="font-semibold">{invite ? "Zaproszenie gotowe" : "Masz link do domu?"}</h2>
            {invite && <p className="muted">{session ? "Podaj swoje imię i dołącz poniżej." : "Zaloguj się przez Google, aby dołączyć. Link zachowamy na czas logowania."}</p>}
            <form className="space-y-3 mt-3" onSubmit={e => { e.preventDefault(); applyInvite(); }}>
                <label className="block text-sm" htmlFor="house-invitation">{invite ? "Wklej inny link zaproszenia" : "Link zaproszenia"}</label>
                <input id="house-invitation" className="input" type="url" required value={inviteInput} onChange={e => setInviteInput(e.target.value)} placeholder="https://…/?invite=…" autoComplete="off" spellCheck={false} disabled={busy} />
                <div className="flex flex-wrap gap-2">
                    <button className="btn-secondary" disabled={busy || !inviteInput.trim()}>Użyj linku</button>
                    {invite && <button type="button" className="text-button" disabled={busy} onClick={clearInvite}>Anuluj zaproszenie</button>}
                </div>
            </form>
            {!invite && <p className="muted mt-3">Poproś domownika o link z zakładki Dom. Nie masz jeszcze domu? Utworzysz go po zalogowaniu.</p>}
        </div>
        {!session ? <div className="space-y-3">
            <button type="button" disabled={busy} className="btn-primary w-full" onClick={() => {
                const token = inviteInput.trim() ? applyInvite() : invite;
                if (inviteInput.trim() && !token) return;
                void run(async () => {
                    const { error } = await client.auth.signInWithOAuth({
                        provider: "google",
                        options: {
                            redirectTo: window.location.origin + (token ? `/?invite=${encodeURIComponent(token)}` : "/"),
                            queryParams: { prompt: "select_account" },
                        },
                    });
                    if (error) throw error;
                });
            }}>{busy ? "Łączenie…" : "Zaloguj się przez Google"}</button>
            <p className="muted text-center">Jedno konto Google. Twój wspólny dom.</p>
        </div> : !loaded ? <><p role="status">Wczytywanie domu…</p><button className="btn-secondary" onClick={() => void run(refresh)}>Spróbuj ponownie</button></> : <form className="space-y-4" onSubmit={e => { e.preventDefault(); void run(async () => {
            const token = inviteInput.trim() ? applyInvite() : invite;
            if (inviteInput.trim() && !token) return;
            const { error } = token ? await client.rpc("oikos_join_house", { token, member_name: name.trim() }) : await client.rpc("oikos_create_house", { house_name: houseName, member_name: name.trim() });
            if (error) throw error;
            sessionStorage.removeItem("oikos-invite"); window.history.replaceState({}, "", "/"); setInvite("");
            await refresh();
        }); }}>
            <label className="block">Twoje imię<input required maxLength={80} autoComplete="given-name" className="input mt-2" value={name} onChange={e => setName(e.target.value)} /></label>
            {invite || inviteInput.trim() ? <p>Masz zaproszenie do wspólnego domu.</p> : <label className="block">Nazwa domu<input required maxLength={100} className="input mt-2" value={houseName} onChange={e => setHouseName(e.target.value)} placeholder="Nasz dom" /></label>}
            <button disabled={busy} className="btn-primary">{invite || inviteInput.trim() ? "Dołącz do domu" : "Utwórz dom"}</button>
            
            <p className="muted">Każdy dom ma osobny link. Po utworzeniu domu znajdziesz go w zakładce Dom.</p>
        </form>}
        {session && <button disabled={busy} className="text-button" onClick={() => void run(async () => { const { error } = await client.auth.signOut(); if (error) throw error; setRecord(null); })}>Wyloguj</button>}
    </section></main>;
}

function viewState(record: RecordState, userId: string): OikosState {
    return { ...record.state, activeMemberId: userId, house: { ...record.state.house, inviteToken: record.invite_token,
        inviteLink: `${window.location.origin}/?invite=${encodeURIComponent(record.invite_token)}` } };
}
