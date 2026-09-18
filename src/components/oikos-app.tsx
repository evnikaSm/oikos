"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import CleaningCalendar from "./cleaning-calendar";
import { QRCodeSVG } from "qrcode.react";
import {
    ArrowRight,
    Check,
    ClipboardList,
    CreditCard,
    Droplets,
    House,
    LayoutDashboard,
    Plus,
    ScanLine,
    ShoppingBag,
    Sparkles,
    Users,
    type LucideIcon,
} from "lucide-react";
import {
    regenerateSchedule,
    removeRetiredZoneDuties,
    createId,
    demoNow,
    demoState,
    formatCurrency,
    formatLongDay,
    formatShortTime,
    getActiveShoppingItems,
    getCleaningParticipants,
    getMemberName,
    getMonthlyContributed,
    parseMoneyAmount,
    getMonthlySpent,
    getOutstandingContributors,
    getPurchasedShoppingItems,
    getShoppingEstimate,
    type HouseMember,
    type OikosState,
    type ShoppingItem,
    type TripStatus,
} from "@/lib/oikos";

type TabKey = "home" | "budget" | "shopping" | "cleaning" | "house";
type SheetMode = "add-item" | "start-trip" | "manual-expense" | null;

const copy = {
    nav: { home: "Start", budget: "Budżet", shopping: "Zakupy", cleaning: "Sprzątanie", house: "Dom" },
    actingAs: "Działasz jako",
    quickActions: "Szybkie akcje",
    addShoppingItem: "Dodaj produkt do listy",
    startShoppingTrip: "Rozpocznij zakupy",
    addManualExpense: "Dodaj ręczny wydatek spożywczy",
    monthlySnapshot: "Miesięczne podsumowanie",
    householdMembers: "Domownicy",
    settings: "Ustawienia",
    save: "Zapisz",
    cancel: "Anuluj",
};

const tabs: Array<{ key: TabKey; label: string; icon: LucideIcon }> = [
    { key: "home", label: "home", icon: LayoutDashboard },
    { key: "budget", label: "budget", icon: CreditCard },
    { key: "shopping", label: "shopping", icon: ShoppingBag },
    { key: "cleaning", label: "cleaning", icon: Droplets },
    { key: "house", label: "house", icon: House },
];

const monthLabel = new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" }).format(demoNow);

type RemoteHousehold = {
    state: OikosState;
    updateState: (updater: (prev: OikosState) => OikosState) => void;
    removeMember: (id: string) => void;
};

export default function OikosApp({ remote }: { remote?: RemoteHousehold } = {}) {
    const [localState, setState] = useState<OikosState>(demoState);
    const state = remote?.state ?? localState;
    const connected = Boolean(remote);
    const [activeTab, setActiveTab] = useState<TabKey>("home");
    const [quickOpen, setQuickOpen] = useState(false);
    const [sheetMode, setSheetMode] = useState<SheetMode>(null);
    const [copied, setCopied] = useState(false);
    const [ready, setReady] = useState(false);
    const [storageError, setStorageError] = useState("");
    const [itemName, setItemName] = useState("");
    const [itemQuantity, setItemQuantity] = useState("");
    const [itemPrice, setItemPrice] = useState("");
    const [tripStore, setTripStore] = useState("");
    const [manualAmount, setManualAmount] = useState("");
    const [manualNote, setManualNote] = useState("");

    const [budgetAmount, setBudgetAmount] = useState(String(state.monthlyBudget.budgetAmount));
    const budgetCurrency = "PLN";
    const [zoneName, setZoneName] = useState("");
    const [scheduleWeeks, setScheduleWeeks] = useState("8");
    const t = copy;
    useEffect(() => {
        if (connected) return;
        const timer = window.setTimeout(() => {
        try {
            const raw = localStorage.getItem("oikos-state-v1");
            if (raw) {
                const saved = JSON.parse(raw) as OikosState;
                if (!saved.house || !saved.members?.length || !Array.isArray(saved.cleaningAssignments)) throw new Error("Invalid state");
                // Discard obsolete role metadata from previously saved households.
                saved.members = saved.members.map(member => {
                    const normalized = { ...member } as HouseMember & { role?: unknown };
                    delete normalized.role;
                    return normalized;
                });
                setState(saved);
                setBudgetAmount(String(saved.monthlyBudget.budgetAmount));
            }
            setReady(true);
        } catch { setStorageError("Nie udało się odczytać zapisanych danych. Dane w przeglądarce nie zostały nadpisane."); }
        }, 0);
        return () => window.clearTimeout(timer);
    }, [connected]);
    useEffect(() => {
        if (!ready || connected) return;
        try { localStorage.setItem("oikos-state-v1", JSON.stringify(state)); }
        catch { queueMicrotask(() => setStorageError("Nie udało się zapisać zmian. Pozostaną dostępne tylko do odświeżenia strony.")); }
    }, [state, ready, connected]);



    const activeTrip = useMemo(
        () => state.shoppingTrips.find((trip) => trip.status === "active") ?? null,
        [state.shoppingTrips],
    );

    const activeItems = useMemo(() => getActiveShoppingItems(state.shoppingItems), [state.shoppingItems]);
    const purchasedItems = useMemo(() => getPurchasedShoppingItems(state.shoppingItems), [state.shoppingItems]);
    const shoppingEstimate = useMemo(() => getShoppingEstimate(state.shoppingItems), [state.shoppingItems]);
    const contributed = useMemo(() => getMonthlyContributed(state.members), [state.members]);
    const spent = useMemo(() => getMonthlySpent(state.groceryExpenses), [state.groceryExpenses]);
    const remaining = Math.round((contributed - spent) * 100) / 100;
    const uncheckedItems = activeItems.filter((item) => !item.checked).length;
    const pendingContributors = getOutstandingContributors(state.members);
    const cleaningParticipants = getCleaningParticipants(state.members);

    const updateState = (updater: (prev: OikosState) => OikosState) => {
        if (remote) remote.updateState(updater);
        else setState((prev) => updater(prev));
    };

    const saveBudgetSettings = () => {
        const amount = parseMoneyAmount(budgetAmount);
        if (amount === null) { setStorageError("Podaj poprawną kwotę budżetu (zero lub więcej, maksymalnie dwa miejsca po przecinku)."); return; }
        setStorageError("");
        updateState(prev => ({ ...prev, monthlyBudget: { ...prev.monthlyBudget, budgetAmount: amount } }));
    };

    const saveContribution = (memberId: string, amount: number) => {
        if (memberId !== state.activeMemberId) return;
        updateState(prev => ({ ...prev, members: prev.members.map(member => member.id === memberId ? { ...member, contributionAmount: amount } : member) }));
    };

    const addShoppingItem = () => {
        if (!itemName.trim()) return;
        const price = itemPrice.trim() ? Number(itemPrice) : null;
        updateState((prev) => {
            const now = new Date().toISOString();
            return {
                ...prev,
                shoppingItems: [
                    {
                        id: createId("item"),
                        name: itemName.trim(),
                        quantity: itemQuantity.trim(),
                        estimatedPrice: Number.isFinite(price ?? NaN) ? price : null,
                        creatorId: prev.activeMemberId,
                        createdAt: now,
                        state: "active",
                        checked: false,
                        purchasedTripId: null,
                    },
                    ...prev.shoppingItems,
                ],
                priceMemory: Number.isFinite(price ?? NaN)
                    ? { ...prev.priceMemory, [itemName.trim()]: price as number }
                    : prev.priceMemory,
            };
        });
        setItemName("");
        setItemQuantity("");
        setItemPrice("");
        setSheetMode(null);
    };

    const startTrip = () => {
        updateState((prev) => {
            if (prev.shoppingTrips.some((trip) => trip.status === "active")) return prev;
            const now = new Date().toISOString();
            const snapshots = prev.shoppingItems
                .filter((item) => item.state === "active")
                .map((item) => ({
                    itemId: item.id,
                    name: item.name,
                    quantity: item.quantity,
                    estimatedPrice: item.estimatedPrice,
                    checkedAt: item.checked ? now : null,
                }));
            return {
                ...prev,
                shoppingTrips: [
                    {
                        id: createId("trip"),
                        purchaserId: prev.activeMemberId,
                        startedAt: now,
                        finishedAt: null,
                        totalAmount: null,
                        storeName: tripStore.trim(),
                        status: "active",
                        itemSnapshots: snapshots,
                        purchasedItemIds: [],
                    },
                    ...prev.shoppingTrips,
                ],
            };
        });
        setTripStore("");
        setSheetMode(null);
    };

    const finishTrip = () => {
        const amount = Number(prompt("Total amount paid"));
        if (!Number.isFinite(amount) || amount <= 0 || !activeTrip) return;
        const storeName = prompt("Optional store name", activeTrip.storeName) ?? activeTrip.storeName;
        updateState((prev) => {
            const now = new Date().toISOString();
            const purchasedIds = prev.shoppingItems.filter((item) => item.state === "active" && item.checked).map((item) => item.id);
            return {
                ...prev,
                shoppingItems: prev.shoppingItems.map((item) =>
                    purchasedIds.includes(item.id)
                        ? { ...item, state: "purchased", purchasedTripId: activeTrip.id }
                        : item,
                ),
                shoppingTrips: prev.shoppingTrips.map((trip) =>
                    trip.id === activeTrip.id
                        ? {
                            ...trip,
                            status: "completed" as TripStatus,
                            finishedAt: now,
                            totalAmount: amount,
                            storeName: storeName.trim(),
                            purchasedItemIds: purchasedIds,
                        }
                        : trip,
                ),
                groceryExpenses: [
                    {
                        id: createId("expense"),
                        amount,
                        note: storeName.trim() || "Shopping trip",
                        purchaserId: prev.activeMemberId,
                        createdAt: now,
                        type: "trip",
                        tripId: activeTrip.id,
                    },
                    ...prev.groceryExpenses,
                ],
            };
        });
    };

    const addManualExpense = () => {
        const amount = Number(manualAmount);
        if (!Number.isFinite(amount) || amount <= 0) return;
        updateState((prev) => ({
            ...prev,
            groceryExpenses: [
                {
                    id: createId("expense"),
                    amount,
                    note: manualNote.trim(),
                    purchaserId: prev.activeMemberId,
                    createdAt: new Date().toISOString(),
                    type: "manual",
                    tripId: null,
                },
                ...prev.groceryExpenses,
            ],
        }));
        setManualAmount("");
        setManualNote("");
        setSheetMode(null);
    };

    const toggleContributionPaid = (memberId: string) => {
        if (memberId !== state.activeMemberId) return;
        updateState((prev) => ({
            ...prev,
            members: prev.members.map((member) =>
                member.id === memberId
                    ? {
                        ...member,
                        contributionStatus: member.contributionStatus === "paid" ? "unpaid" : "paid",
                        contributionPaidAt: member.contributionStatus === "paid" ? null : new Date().toISOString(),
                    }
                    : member,
            ),
        }));
    };

    const toggleCleaningIncluded = (memberId: string) => {
        updateState((prev) => ({
            ...prev,
            members: prev.members.map((member) =>
                member.id === memberId ? { ...member, includeInCleaning: !member.includeInCleaning } : member,
            ),
        }));
    };

    const addCleaningZone = () => {
        if (!zoneName.trim()) return;
        updateState((prev) => {
            const next = { ...prev, cleaningZones: [...prev.cleaningZones, { id: createId("zone"), name: zoneName.trim(), order: prev.cleaningZones.length }] };
            return { ...next, cleaningAssignments: regenerateSchedule(next, new Date(), Number(scheduleWeeks)) };
        });
        setZoneName("");
    };

    const generateSchedule = (weeks = Number(scheduleWeeks) || 8) => {
        updateState(prev => ({ ...prev, cleaningAssignments: regenerateSchedule(prev, new Date(), weeks) }));
    };

    const rebalanceFuture = () => generateSchedule();

    const completeAssignment = (assignmentId: string) => {
        updateState((prev) => ({
            ...prev,
            cleaningAssignments: prev.cleaningAssignments.map((assignment) =>
                assignment.id === assignmentId && assignment.status !== "completed" && assignment.assignedMemberId === prev.activeMemberId
                    ? {
                        ...assignment,
                        status: "completed",
                        completedAt: new Date().toISOString(),
                        completedById: prev.activeMemberId,
                    }
                    : assignment,
            ),
        }));
    };

    const overrideAssignmentMember = (assignmentId: string, memberId: string) => {
        updateState((prev) => ({
            ...prev,
            cleaningAssignments: prev.cleaningAssignments.map((assignment) => {
                if (assignment.id !== assignmentId || assignment.status === "completed" || assignment.assignedMemberId !== prev.activeMemberId) return assignment;
                const member = prev.members.find((m) => m.id === memberId);
                return {
                    ...assignment,
                    assignedMemberId: member?.id ?? null,
                    assignedMemberName: member?.name ?? "Rest",
                    manualOverride: true,
                };
            }),
        }));
    };

    const addDemoInviteCopy = async () => {
        try { await navigator.clipboard.writeText(state.house.inviteLink); }
        catch { setStorageError("Nie można skopiować linku. Zaznacz i skopiuj go ręcznie."); return; }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
    };

    const removeMember = (memberId: string) => {
        if (remote) { remote.removeMember(memberId); return; }
        if (state.members.length <= 1) return;
        updateState((prev) => ({
            ...prev,
            members: prev.members.filter((member) => member.id !== memberId),
            formerMembers: { ...prev.formerMembers, [memberId]: getMemberName(prev.members, memberId) },
            cleaningAssignments: prev.cleaningAssignments.map((assignment) =>
                assignment.assignedMemberId === memberId && assignment.status !== "completed"
                    ? { ...assignment, assignedMemberId: null, assignedMemberName: "Rest" }
                    : assignment,
            ),
        }));
    };

    const activeTripPurchasedCount = activeTrip?.purchasedItemIds.length ?? 0;

    return (
        <div className="min-h-[100dvh] bg-[var(--oikos-cream)] text-[var(--oikos-burgundy)]">
            <div className="app-shell mx-auto flex min-h-[100dvh] w-full max-w-[960px] flex-col px-3 pb-40 pt-3 sm:px-6">
                <header className="mb-3 rounded-[28px] bg-[var(--oikos-ivory)] px-4 py-4 shadow-[0_12px_30px_rgba(40,0,3,0.08)] ring-1 ring-black/5">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--oikos-green)]">Oikos</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                            <h1 className="text-lg font-semibold">{state.house.name}</h1>
                            <span className="rounded-full bg-[var(--oikos-yellow)] px-2.5 py-1 text-xs font-semibold text-[var(--oikos-burgundy)]">
                                {connected ? state.monthlyBudget.monthKey : monthLabel}
                            </span>
                        </div>
                    </div>
                    {!connected && <div className="mt-3 grid gap-2">
                        <label className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--oikos-cream)] px-3 py-2 text-sm font-medium">
                            <span className="text-[var(--oikos-green)]">{t.actingAs}</span>
                            <select
                                value={state.activeMemberId}
                                onChange={(event) => setState((prev) => ({ ...prev, activeMemberId: event.target.value }))}
                                className="min-w-0 max-w-[60%] bg-transparent text-sm outline-none"
                            >
                                {state.members.map((member) => (
                                    <option key={member.id} value={member.id}>
                                        {member.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>}
                </header>

                <main className="flex-1 space-y-4">
                    {storageError && <p role="alert" className="notice">{storageError}</p>}
                    {activeTab === "home" && (
                        <HomeTab
                            state={state}
                            activeTrip={activeTrip}
                            activeTripPurchasedCount={activeTripPurchasedCount}
                            shoppingEstimate={shoppingEstimate}
                            remaining={remaining}
                            contributed={contributed}
                            spent={spent}
                            uncheckedItems={uncheckedItems}
                            pendingContributors={pendingContributors}
                            onOpenSheet={setSheetMode}
                            onToggleContribution={toggleContributionPaid}
                            onFinishTrip={finishTrip}
                            onNavigate={setActiveTab}
                            t={t}
                        />
                    )}

                    {activeTab === "budget" && (
                        <BudgetTab
                            state={state}
                            contributed={contributed}
                            spent={spent}
                            remaining={remaining}
                            budgetAmount={budgetAmount}
                            budgetCurrency={budgetCurrency}
                            setBudgetAmount={setBudgetAmount}
                            onSaveBudget={saveBudgetSettings}
                            onSaveContribution={saveContribution}
                            onToggleContribution={toggleContributionPaid}
                            onOpenSheet={setSheetMode}
                            t={t}
                        />
                    )}

                    {activeTab === "shopping" && (
                        <ShoppingTab
                            state={state}
                            activeTrip={activeTrip}
                            activeItems={activeItems}
                            purchasedItems={purchasedItems}
                            shoppingEstimate={shoppingEstimate}
                            remaining={remaining}
                            activeTripPurchasedCount={activeTripPurchasedCount}
                            onToggleItem={(itemId) => {
                                if (!activeTrip) return;
                                updateState((prev) => {
                                    const now = new Date().toISOString();
                                    const trip = prev.shoppingTrips.find((entry) => entry.id === activeTrip.id);
                                    const isChecked = prev.shoppingItems.find((item) => item.id === itemId)?.checked;
                                    const purchasedItemIds = new Set(trip?.purchasedItemIds ?? []);
                                    if (isChecked) purchasedItemIds.delete(itemId);
                                    else purchasedItemIds.add(itemId);
                                    return {
                                        ...prev,
                                        shoppingItems: prev.shoppingItems.map((item) =>
                                            item.id === itemId ? { ...item, checked: !item.checked } : item,
                                        ),
                                        shoppingTrips: prev.shoppingTrips.map((tripItem) =>
                                            tripItem.id === activeTrip.id
                                                ? {
                                                    ...tripItem,
                                                    itemSnapshots: tripItem.itemSnapshots.map((snapshot) =>
                                                        snapshot.itemId === itemId
                                                            ? { ...snapshot, checkedAt: !isChecked ? now : null }
                                                            : snapshot,
                                                    ),
                                                    purchasedItemIds: Array.from(purchasedItemIds),
                                                }
                                                : tripItem,
                                        ),
                                    };
                                });
                            }}
                            onFinishTrip={finishTrip}
                            onOpenSheet={setSheetMode}
                        />
                    )}

                    {activeTab === "cleaning" && (
                        <CleaningTab
                            state={state}
                            cleaningParticipants={cleaningParticipants}
                            onRenameZone={(id, name) => updateState(prev => {
                                const next = { ...prev, cleaningZones: prev.cleaningZones.map(z => z.id === id ? { ...z, name } : z) };
                                return { ...next, cleaningAssignments: regenerateSchedule(next, new Date(), Number(scheduleWeeks)) };
                            })}
                            zoneName={zoneName}
                            scheduleWeeks={scheduleWeeks}
                            setZoneName={setZoneName}
                            setScheduleWeeks={setScheduleWeeks}
                            onAddZone={addCleaningZone}
                            onRemoveZone={id => updateState(prev => {
                                const next = { ...prev, cleaningZones: prev.cleaningZones.filter(zone => zone.id !== id).map((zone, order) => ({ ...zone, order })) };
                                return { ...next, cleaningAssignments: removeRetiredZoneDuties(next, new Date()) };
                            })}
                            onGenerateSchedule={generateSchedule}
                            onRebalance={rebalanceFuture}
                            onCompleteAssignment={completeAssignment}
                            onOverrideAssignmentMember={overrideAssignmentMember}
                        />
                    )}

                    {activeTab === "house" && (
                        <HouseTab
                            state={state}
                            connected={connected}
                            copied={copied}
                            onCopyInvite={addDemoInviteCopy}
                            onToggleCleaningIncluded={toggleCleaningIncluded}
                            onRemoveMember={removeMember}
                            onSaveBudget={saveBudgetSettings}
                            budgetAmount={budgetAmount}
                            setBudgetAmount={setBudgetAmount}
                            t={t}
                        />
                    )}
                </main>
            </div>

            <QuickActionButton open={quickOpen} onToggle={() => setQuickOpen((value) => !value)} />

            {quickOpen && (
                <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" onClick={() => setQuickOpen(false)} />
            )}
            {quickOpen && (
                <div className="fixed bottom-24 right-4 z-50 w-[min(20rem,calc(100vw-2rem))] rounded-[24px] bg-[var(--oikos-ivory)] p-3 shadow-[0_24px_60px_rgba(40,0,3,0.18)] ring-1 ring-black/5">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--oikos-green)]">{t.quickActions}</p>
                    <div className="space-y-2">
                        <QuickActionRow icon={Plus} label={t.addShoppingItem} onClick={() => { setSheetMode("add-item"); setQuickOpen(false); }} />
                        <QuickActionRow icon={ScanLine} label={t.startShoppingTrip} onClick={() => { setSheetMode("start-trip"); setQuickOpen(false); }} />
                        <QuickActionRow icon={CreditCard} label={t.addManualExpense} onClick={() => { setSheetMode("manual-expense"); setQuickOpen(false); }} />
                    </div>
                </div>
            )}

            <BottomNav activeTab={activeTab} onChange={setActiveTab} t={t} />

            {sheetMode && (
                <SheetOverlay onClose={() => setSheetMode(null)}>
                    {sheetMode === "add-item" && (
                        <SheetCard title="Dodaj produkt" icon={ClipboardList}>
                            <div className="space-y-3">
                                <Field label="Nazwa produktu">
                                    <input value={itemName} onChange={(event) => setItemName(event.target.value)} className="input" placeholder="Mleko" />
                                </Field>
                                <Field label="Ilość">
                                    <input value={itemQuantity} onChange={(event) => setItemQuantity(event.target.value)} className="input" placeholder="2 l" />
                                </Field>
                                <Field label="Szacowana cena">
                                    <input
                                        value={itemPrice}
                                        onChange={(event) => setItemPrice(event.target.value)}
                                        className="input"
                                        placeholder={state.priceMemory[itemName.trim()] ? formatCurrency(state.priceMemory[itemName.trim()], state.monthlyBudget.currency) : "Opcjonalnie"}
                                        inputMode="decimal"
                                    />
                                </Field>
                                <ActionRow>
                                    <button className="btn-primary" onClick={addShoppingItem}>Dodaj produkt</button>
                                    <button className="btn-secondary" onClick={() => setSheetMode(null)}>{t.cancel}</button>
                                </ActionRow>
                            </div>
                        </SheetCard>
                    )}

                    {sheetMode === "start-trip" && (
                        <SheetCard title="Rozpocznij zakupy" icon={ScanLine}>
                            <div className="space-y-3">
                                <Field label="Opcjonalna nazwa sklepu">
                                    <input value={tripStore} onChange={(event) => setTripStore(event.target.value)} className="input" placeholder="Lidl" />
                                </Field>
                                <p className="rounded-2xl bg-[var(--oikos-cream)] px-4 py-3 text-sm text-[var(--oikos-burgundy)]/80">
                                    Migawka zachowa listę zakupów nawet wtedy, gdy lista wspólna się później zmieni.
                                </p>
                                <ActionRow>
                                    <button className="btn-primary" onClick={startTrip}>Rozpocznij</button>
                                    <button className="btn-secondary" onClick={() => setSheetMode(null)}>{t.cancel}</button>
                                </ActionRow>
                            </div>
                        </SheetCard>
                    )}

                    {sheetMode === "manual-expense" && (
                        <SheetCard title="Dodaj ręczny wydatek" icon={CreditCard}>
                            <div className="space-y-3">
                                <Field label="Kwota">
                                    <input value={manualAmount} onChange={(event) => setManualAmount(event.target.value)} className="input" placeholder="7,80" inputMode="decimal" />
                                </Field>
                                <Field label="Notatka">
                                    <input value={manualNote} onChange={(event) => setManualNote(event.target.value)} className="input" placeholder="Chleb i mleko" />
                                </Field>
                                <ActionRow>
                                    <button className="btn-primary" onClick={addManualExpense}>Zapisz wydatek</button>
                                    <button className="btn-secondary" onClick={() => setSheetMode(null)}>{t.cancel}</button>
                                </ActionRow>
                            </div>
                        </SheetCard>
                    )}
                </SheetOverlay>
            )}
        </div>
    );
}

function HomeTab({
    state,
    activeTrip,
    activeTripPurchasedCount,
    shoppingEstimate,
    remaining,
    contributed,
    spent,
    uncheckedItems,
    pendingContributors,
    onOpenSheet,
    onToggleContribution,
    onFinishTrip,
    onNavigate,
    t,
}: {
    state: OikosState;
    activeTrip: OikosState["shoppingTrips"][number] | null;
    activeTripPurchasedCount: number;
    shoppingEstimate: number;
    remaining: number;
    contributed: number;
    spent: number;
    uncheckedItems: number;
    pendingContributors: HouseMember[];
    onOpenSheet: (mode: SheetMode) => void;
    onToggleContribution: (memberId: string) => void;
    onFinishTrip: () => void;
    onNavigate: (tab: TabKey) => void;
    t: typeof copy;
}) {
    const av = state.members.slice(0, 3);
    return (
        <div className="space-y-4">
            <section className="panel">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-sm font-medium text-[var(--oikos-green)]">Dziś w {state.house.name}</p>
                        <h2 className="mt-1 text-2xl font-semibold leading-tight">Spokojny pulpit domu na dziś.</h2>
                    </div>
                    <div className="rounded-2xl bg-[var(--oikos-yellow)] p-3 text-[var(--oikos-burgundy)]">
                        <Sparkles size={22} />
                    </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    {av.map((member) => (
                        <AvatarChip key={member.id} member={member} compact />
                    ))}
                    <span className="text-sm text-[var(--oikos-burgundy)]/70 whitespace-nowrap">{state.members.length} osoby</span>
                </div>
            </section>

            <div className="grid grid-cols-2 gap-3">
                <MetricCard label="Budżet miesięczny" value={formatCurrency(state.monthlyBudget.budgetAmount, state.monthlyBudget.currency)} tone="yellow" />
                <MetricCard label="Zostało" value={formatCurrency(remaining, state.monthlyBudget.currency)} tone="green" />
                <MetricCard label="Wpłacono" value={formatCurrency(contributed, state.monthlyBudget.currency)} tone="ivory" />
                <MetricCard label="Wydano" value={formatCurrency(spent, state.monthlyBudget.currency)} tone="ivory" />
            </div>

            <section className="grid gap-3">
                <section className="rounded-[28px] bg-[var(--oikos-yellow)]/35 p-5 shadow-[0_14px_40px_rgba(40,0,3,0.08)] ring-1 ring-black/5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-medium text-[var(--oikos-green)]">Dzisiaj</p>
                            <h3 className="text-xl font-semibold leading-tight">Co jest ważne teraz</h3>
                        </div>
                        <div className="rounded-full bg-[var(--oikos-ivory)] px-3 py-2 text-sm font-semibold text-[var(--oikos-burgundy)]">
                            {formatCurrency(remaining, state.monthlyBudget.currency)}
                        </div>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <MiniStat label="Lista" value={`${uncheckedItems} do odhaczenia`} />
                        <MiniStat label="Koszyk" value={formatCurrency(shoppingEstimate, state.monthlyBudget.currency)} />
                    </div>
                </section>

                <InfoCard title="Lista zakupów" icon={ClipboardList} actionText="Dodaj" onAction={() => onOpenSheet("add-item")}>
                    <p className="text-sm text-[var(--oikos-burgundy)]/70">{uncheckedItems} nieodznaczonych pozycji · Szacowany koszyk {formatCurrency(shoppingEstimate, state.monthlyBudget.currency)}</p>
                    <p className="mt-3 text-sm text-[var(--oikos-green)]">{formatCurrency(remaining, state.monthlyBudget.currency)} zostało w tym miesiącu</p>
                </InfoCard>

                <InfoCard title="Zakupy" icon={ScanLine} actionText={activeTrip ? "Zakończ" : "Start"} onAction={activeTrip ? onFinishTrip : () => onOpenSheet("start-trip")}>
                    <p className="text-sm text-[var(--oikos-burgundy)]/70">{activeTrip ? `${activeTrip.storeName || "Bieżące zakupy"} · ${activeTripPurchasedCount} w koszyku` : "Nie trwa teraz żaden spacer po sklepie."}</p>
                    <p className="mt-3 text-sm text-[var(--oikos-green)]">{activeTrip ? nextTripLabel(activeTrip.startedAt) : "Gotowe, gdy ktoś ruszy po zakupy."}</p>
                </InfoCard>
            </section>

            <section className="grid gap-3">


                <InfoCard title="Wpłaty" icon={Users} actionText="Sprawdź" onAction={() => onNavigate("budget")}>
                    <p className="text-sm text-[var(--oikos-burgundy)]/70">{pendingContributors.length} osoby jeszcze nie wpłaciły swojej części.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {pendingContributors.map((member) => (
                            member.id === state.activeMemberId ? <button key={member.id} onClick={() => onToggleContribution(member.id)} className="rounded-full bg-[var(--oikos-yellow)] px-3 py-2 text-xs font-semibold text-[var(--oikos-burgundy)]">
                                Potwierdź moją wpłatę
                            </button> : <span key={member.id} className="rounded-full bg-[var(--oikos-cream)] px-3 py-2 text-xs">{member.name} · Niepotwierdzona</span>
                        ))}
                    </div>
                </InfoCard>
            </section>

            <section className="panel">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-medium text-[var(--oikos-green)]">{t.monthlySnapshot}</p>
                        <h3 className="text-lg font-semibold">Czego dom potrzebuje teraz</h3>
                    </div>
                    <span className="rounded-full bg-[var(--oikos-cream)] px-3 py-1 text-xs font-semibold text-[var(--oikos-green)]">{formatLongDay(demoNow)}</span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <MiniStat label="Nieodznaczone" value={String(uncheckedItems)} />
                    <MiniStat label="Koszyk" value={formatCurrency(shoppingEstimate, state.monthlyBudget.currency)} />
                    <MiniStat label="Saldo domu" value={formatCurrency(remaining, state.monthlyBudget.currency)} />
                </div>
            </section>
        </div>
    );
}

function ContributionField({ member, currency, onSave }: { member: HouseMember; currency: string; onSave: (id: string, amount: number) => void }) {
    const [value, setValue] = useState(String(member.contributionAmount));
    const [error, setError] = useState("");
    return <form className="space-y-2" onSubmit={event => {
        event.preventDefault();
        const amount = parseMoneyAmount(value);
        if (amount === null) { setError("Podaj kwotę od 0, z maksymalnie dwoma miejscami po przecinku."); return; }
        setError(""); onSave(member.id, amount);
    }}>
        <div className="flex flex-wrap gap-2">
            <input className="input flex-1 min-w-0" aria-label={`Oczekiwana wpłata: ${member.name} (${currency})`} inputMode="decimal" value={value} onChange={event => setValue(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `contribution-error-${member.id}` : undefined} />
            <button className="btn-secondary" type="submit" disabled={parseMoneyAmount(value) === member.contributionAmount}>Zapisz wpłatę</button>
        </div>
        {error && <p id={`contribution-error-${member.id}`} role="alert" className="text-sm text-[var(--oikos-accent)]">{error}</p>}
    </form>;
}

function BudgetTab({
    state,
    contributed,
    spent,
    remaining,
    budgetAmount,
    budgetCurrency,
    setBudgetAmount,
    onSaveBudget,
    onSaveContribution,
    onToggleContribution,
    onOpenSheet,
    t,
}: {
    state: OikosState;
    contributed: number;
    spent: number;
    remaining: number;
    budgetAmount: string;
    budgetCurrency: string;
    setBudgetAmount: (value: string) => void;
    onSaveBudget: () => void;
    onSaveContribution: (id: string, amount: number) => void;
    onToggleContribution: (memberId: string) => void;
    onOpenSheet: (mode: SheetMode) => void;
    t: typeof copy;
}) {
    return (
        <div className="space-y-4">
            <section className="panel">
                <p className="text-sm font-medium text-[var(--oikos-green)]">Wspólny budżet spożywczy</p>
                <h2 className="mt-1 text-2xl font-semibold">Budżet jedzenia na miesiąc</h2>
                <div className="mt-4 grid grid-cols-2 gap-3">
                    <LargeMoney label="Budżet" value={formatCurrency(state.monthlyBudget.budgetAmount, state.monthlyBudget.currency)} />
                    <LargeMoney label="Wpłacono" value={formatCurrency(contributed, state.monthlyBudget.currency)} />
                    <LargeMoney label="Wydano" value={formatCurrency(spent, state.monthlyBudget.currency)} />
                    <LargeMoney label="Zostało" value={formatCurrency(remaining, state.monthlyBudget.currency)} accent />
                </div>
            </section>

            <section className="panel">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-medium text-[var(--oikos-green)]">Ustawienia budżetu</p>
                        <h3 className="text-lg font-semibold">Budżet i wpłaty</h3>
                    </div>
                    <button className="btn-primary text-sm" onClick={onSaveBudget}>{t.save}</button>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field label="Kwota miesięczna">
                        <input className="input" value={budgetAmount} onChange={(event) => setBudgetAmount(event.target.value)} inputMode="decimal" />
                    </Field>

                </div>
                <p className="muted mt-4">Wpłacono to suma zapisanych kwot wszystkich domowników. Zostało = Wpłacono − Wydano. Potwierdzenie wpłaty nie zmienia sumy.</p>
                <div className="mt-4 space-y-3">
                    {state.members.map((member) => (
                        <div key={member.id} className="rounded-2xl bg-[var(--oikos-cream)] p-3">
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <div>
                                    <p className="font-medium">{member.name}</p>
                                    <p className="text-xs text-[var(--oikos-burgundy)]/60">Oczekiwana wpłata · {budgetCurrency}</p>
                                </div>
                                <label className="inline-flex items-center gap-2 text-xs font-medium text-[var(--oikos-green)]">
                                    <input type="checkbox" disabled={member.id !== state.activeMemberId} checked={member.contributionStatus === "paid"} onChange={() => onToggleContribution(member.id)} />
                                    {member.contributionStatus === "paid" ? "Potwierdzona" : member.id === state.activeMemberId ? "Potwierdź wpłatę" : "Niepotwierdzona"}
                                </label>
                            </div>
                            {member.id === state.activeMemberId ? (
                                <ContributionField key={`${member.id}:${member.contributionAmount}`} member={member} currency={budgetCurrency} onSave={onSaveContribution} />
                            ) : (
                                <div>
                                    <p className="text-lg font-semibold">{formatCurrency(member.contributionAmount, budgetCurrency)}</p>
                                    <p className="muted">Tę kwotę może zmienić tylko {member.name}.</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            <section className="panel">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-medium text-[var(--oikos-green)]">Ostatnie wydatki</p>
                        <h3 className="text-lg font-semibold">Historia zakupów</h3>
                    </div>
                    <button className="btn-secondary text-sm" onClick={() => onOpenSheet("manual-expense")}>Dodaj wydatek</button>
                </div>
                <div className="mt-4 space-y-3">
                    {state.groceryExpenses.slice(0, 4).map((expense) => (
                        <div key={expense.id} className="flex items-center justify-between rounded-2xl bg-[var(--oikos-cream)] px-4 py-3">
                            <div>
                                <p className="font-medium">{formatCurrency(expense.amount, state.monthlyBudget.currency)}</p>
                                <p className="text-sm text-[var(--oikos-burgundy)]/70">{expense.note || expense.type}</p>
                            </div>
                            <p className="text-sm text-[var(--oikos-green)]">{getMemberName(state.members, expense.purchaserId, state.formerMembers)}</p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}

function ShoppingTab({
    state,
    activeTrip,
    activeItems,
    purchasedItems,
    shoppingEstimate,
    remaining,
    activeTripPurchasedCount,
    onToggleItem,
    onFinishTrip,
    onOpenSheet,
}: {
    state: OikosState;
    activeTrip: OikosState["shoppingTrips"][number] | null;
    activeItems: ShoppingItem[];
    purchasedItems: ShoppingItem[];
    shoppingEstimate: number;
    remaining: number;
    activeTripPurchasedCount: number;
    onToggleItem: (itemId: string) => void;
    onFinishTrip: () => void;
    onOpenSheet: (mode: SheetMode) => void;
}) {
    return (
        <div className="space-y-4">
            <section className="panel">
                <p className="text-sm font-medium text-[var(--oikos-green)]">Wspólna lista zakupów</p>
                <h2 className="mt-1 text-2xl font-semibold">Wspólny koszyk dla całego domu.</h2>
                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                    <span className="rounded-full bg-[var(--oikos-yellow)] px-3 py-2 font-semibold">Szacowany koszyk · {formatCurrency(shoppingEstimate, state.monthlyBudget.currency)}</span>
                    <span className="rounded-full bg-[var(--oikos-cream)] px-3 py-2 text-[var(--oikos-green)]">{formatCurrency(remaining, state.monthlyBudget.currency)} zostało w tym miesiącu</span>
                </div>
            </section>

            <section className="panel">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-medium text-[var(--oikos-green)]">Aktywna lista</p>
                        <h3 className="text-lg font-semibold">{activeItems.length} pozycji</h3>
                    </div>
                    <button className="btn-primary text-sm" onClick={() => onOpenSheet("add-item")}>Dodaj</button>
                </div>
                <div className="mt-4 space-y-2">
                    {activeItems.length ? activeItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onToggleItem(item.id)}
                            className="flex w-full items-center rounded-2xl bg-[var(--oikos-cream)] px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                            <span className="mr-3 text-[var(--oikos-green)]">{item.checked ? <Check size={18} /> : <span className="inline-block h-[18px] w-[18px] rounded-full border-2 border-[var(--oikos-green)]" />}</span>
                            <span className="flex-1">
                                <span className="block font-medium">{item.name} {item.quantity ? <span className="text-[var(--oikos-burgundy)]/60">· {item.quantity}</span> : null}</span>
                                <span className="block text-xs text-[var(--oikos-burgundy)]/55">Dodał(a) {getMemberName(state.members, item.creatorId, state.formerMembers)}</span>
                            </span>
                            <span className="text-sm text-[var(--oikos-green)]">{item.estimatedPrice != null ? `~${formatCurrency(item.estimatedPrice, state.monthlyBudget.currency)}` : ""}</span>
                        </button>
                    )) : (
                        <EmptyState text="Lista zakupów jest pusta. Oikos ma już chyba wszystko, czego potrzeba." />
                    )}
                </div>
            </section>

            <section className="grid gap-3 md:grid-cols-2">
                <InfoCard title="Zakupy" icon={ScanLine} actionText={activeTrip ? "Zakończ" : "Start"} onAction={activeTrip ? onFinishTrip : () => onOpenSheet("start-trip")}>
                    <p className="text-sm text-[var(--oikos-burgundy)]/70">{activeTrip ? `Kupione przez ${getMemberName(state.members, activeTrip.purchaserId, state.formerMembers)} · ${activeTripPurchasedCount} zaznaczone` : "Rozpocznij zakupy, żeby zamienić kliknięcia w realny wydatek."}</p>
                    <div className="mt-3 space-y-2">
                        {activeTrip ? activeTrip.itemSnapshots.slice(0, 4).map((snapshot) => (
                            <div key={snapshot.itemId} className="flex items-center justify-between rounded-2xl bg-[var(--oikos-cream)] px-3 py-2 text-sm">
                                <span>{snapshot.name}</span>
                                <span className="text-[var(--oikos-green)]">{snapshot.checkedAt ? "Wzięte" : "Czeka"}</span>
                            </div>
                        )) : null}
                    </div>
                </InfoCard>

                <InfoCard title="Kupione z listy" icon={Check}>
                    <p className="text-sm text-[var(--oikos-burgundy)]/70">Produkty z listy kupione podczas zakończonych zakupów.</p>
                    <div className="mt-3 space-y-2">
                        {purchasedItems.slice(0, 3).map((item) => (
                            <div key={item.id} className="flex items-center justify-between rounded-2xl bg-[var(--oikos-cream)] px-3 py-2 text-sm">
                                <span>{item.name}</span>
                                <span className="text-[var(--oikos-green)]">{item.purchasedTripId ? "Kupiono" : ""}</span>
                            </div>
                        ))}
                    </div>
                </InfoCard>
            </section>
        </div>
    );
}

function CleaningTab(props: {
    state: OikosState;
    cleaningParticipants: HouseMember[];
    zoneName: string;
    scheduleWeeks: string;
    setZoneName: (value: string) => void;
    setScheduleWeeks: (value: string) => void;
    onAddZone: () => void;
    onRenameZone: (id: string, name: string) => void;
    onRemoveZone: (id: string) => void;
    onGenerateSchedule: (weeks?: number) => void;
    onRebalance: () => void;
    onCompleteAssignment: (id: string) => void;
    onOverrideAssignmentMember: (id: string, memberId: string) => void;
}) {
    return <CleaningCalendar {...props} />;
}

function HouseTab({
    state,
    connected,
    copied,
    onCopyInvite,
    onToggleCleaningIncluded,
    onRemoveMember,
    onSaveBudget,
    budgetAmount,
    setBudgetAmount,
    t,
}: {
    state: OikosState;
    connected: boolean;
    copied: boolean;
    onCopyInvite: () => void;
    onToggleCleaningIncluded: (memberId: string) => void;
    onRemoveMember: (memberId: string) => void;
    onSaveBudget: () => void;
    budgetAmount: string;
    setBudgetAmount: (value: string) => void;
    t: typeof copy;
}) {
    return (
        <div className="space-y-4">
            <section className="panel">
                <p className="text-sm font-medium text-[var(--oikos-green)]">Dom</p>
                <h2 className="mt-1 text-2xl font-semibold">{state.house.name}</h2>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                    {state.members.map((member) => (
                        <AvatarChip key={member.id} member={member} />
                    ))}
                </div>
            </section>

            <section className="panel">
                <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                        <p className="text-sm font-medium text-[var(--oikos-green)]">Link zaproszenia</p>
                        <h3 className="text-lg font-semibold">Zaproś do swojego domu</h3>
                        <p className="mt-2 text-sm text-[var(--oikos-burgundy)]/70">Każdy dom ma własny link zaproszenia. Wyślij go domownikom — mogą go otworzyć lub wkleić na stronie logowania, a następnie dołączyć przez Google.</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <button className="btn-primary text-sm" onClick={onCopyInvite}>{copied ? "Skopiowano" : "Kopiuj link"}</button>
                            <span className="rounded-full bg-[var(--oikos-cream)] px-3 py-2 text-xs font-medium text-[var(--oikos-green)]">{state.house.inviteLink}</span>
                        </div>
                    </div>
                    <div className="rounded-[24px] bg-white p-3 shadow-sm ring-1 ring-black/5">
                        <QRCodeSVG value={state.house.inviteLink} size={148} fgColor="#280003" bgColor="#FFFDF9" includeMargin />
                    </div>
                </div>
            </section>

            <section className="panel">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-medium text-[var(--oikos-green)]">Domownicy</p>
                        <h3 className="text-lg font-semibold">Udział w sprzątaniu</h3>
                    </div>
                </div>
                <div className="mt-4 space-y-3">
                    {state.members.map((member) => (
                        <div key={member.id} className="rounded-2xl bg-[var(--oikos-cream)] p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <p className="font-medium">{member.name}</p>
                                    <p className="text-xs text-[var(--oikos-green)]">Wpłata: {formatCurrency(member.contributionAmount, state.monthlyBudget.currency)}</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <label className="inline-flex items-center gap-2 text-xs font-medium text-[var(--oikos-green)]">
                                        <input type="checkbox" checked={member.includeInCleaning} onChange={() => onToggleCleaningIncluded(member.id)} />
                                        Włącz do rotacji
                                    </label>
                                    {member.id !== state.activeMemberId ? (
                                        <button className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-[var(--oikos-burgundy)] shadow-sm" onClick={() => onRemoveMember(member.id)}>
                                            Usuń
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="panel">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-medium text-[var(--oikos-green)]">{t.settings}</p>
                        <h3 className="text-lg font-semibold">Budżet miesięczny</h3>
                    </div>
                    <button className="btn-primary text-sm" onClick={onSaveBudget}>{t.save}</button>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field label="Kwota miesięczna">
                        <input className="input" value={budgetAmount} onChange={(event) => setBudgetAmount(event.target.value)} />
                    </Field>

                </div>
                <p className="muted mt-3">Wpłaty domowników zmienisz w zakładce Budżet.</p>
            </section>

            {!connected && <section className="panel">
                <p className="text-sm font-medium text-[var(--oikos-green)]">Dane demo</p>
                <h3 className="text-lg font-semibold">Oikos Warsaw jest wstępnie załadowany</h3>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {state.cleaningZones.map((zone) => (
                        <div key={zone.id} className="rounded-2xl bg-[var(--oikos-cream)] px-4 py-3 text-sm">
                            {zone.name}
                        </div>
                    ))}
                </div>
            </section>}
        </div>
    );
}

function QuickActionButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
    return (
        <button
            onClick={onToggle}
            className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--oikos-yellow)] text-[var(--oikos-burgundy)] shadow-[0_16px_34px_rgba(40,0,3,0.24)] transition hover:scale-105"
            aria-label="Quick actions"
        >
            <Plus size={30} className={open ? "rotate-45 transition" : "transition"} />
        </button>
    );
}

function BottomNav({ activeTab, onChange, t }: { activeTab: TabKey; onChange: (tab: TabKey) => void; t: typeof copy }) {
    return (
        <nav aria-label="Nawigacja główna" className="fixed inset-x-0 bottom-0 z-50 mt-auto border-t border-black/5 bg-[rgba(255,253,249,0.98)] px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur supports-[backdrop-filter]:bg-[rgba(255,253,249,0.94)]">
            <div className="mx-auto grid max-w-[700px] grid-cols-5 gap-1">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = tab.key === activeTab;
                    return (
                        <button
                            type="button"
                            key={tab.key}
                            aria-current={active ? "page" : undefined}
                            onClick={() => { onChange(tab.key); window.scrollTo({ top: 0 }); }}
                            className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 py-2 text-[10px] sm:text-xs font-medium transition active:scale-[0.98] touch-manipulation ${active ? "bg-[var(--oikos-accent-soft)] text-[var(--oikos-accent)]" : "text-[var(--oikos-burgundy)]/70"
                                }`}
                        >
                            <Icon size={18} className={active ? "text-[var(--oikos-green)]" : ""} />
                            <span>{t.nav[tab.key]}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}

function SheetOverlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 px-3 pb-3 pt-8" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-label="Formularz" className="w-full max-w-2xl max-h-[85dvh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>{children}</div>
        </div>
    );
}

function SheetCard({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
    return (
        <div className="rounded-[28px] bg-[var(--oikos-ivory)] p-5 shadow-[0_24px_60px_rgba(40,0,3,0.22)] ring-1 ring-black/5">
            <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-[var(--oikos-yellow)] p-2 text-[var(--oikos-burgundy)]"><Icon size={20} /></div>
                <h3 className="text-lg font-semibold">{title}</h3>
            </div>
            <div className="mt-4">{children}</div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="block">
            <span className="mb-2 block text-sm font-medium text-[var(--oikos-burgundy)]/75">{label}</span>
            {children}
        </label>
    );
}

function ActionRow({ children }: { children: ReactNode }) {
    return <div className="flex flex-wrap gap-2 pt-2">{children}</div>;
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: "yellow" | "green" | "ivory" }) {
    const styles = {
        yellow: "bg-[var(--oikos-yellow)]",
        green: "bg-[rgba(53,82,74,0.12)]",
        ivory: "bg-[var(--oikos-ivory)]",
    }[tone];
    return (
        <div className={`metric rounded-[24px] p-4 ${styles}`}>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--oikos-burgundy)]/55">{label}</p>
            <p className="mt-2 text-xl font-semibold">{value}</p>
        </div>
    );
}

function LargeMoney({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
    return (
        <div className={`rounded-[24px] p-4 ${accent ? "bg-[var(--oikos-yellow)]" : "bg-[var(--oikos-cream)]"}`}>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--oikos-burgundy)]/55">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
        </div>
    );
}

function InfoCard({ title, icon: Icon, actionText, onAction, children }: { title: string; icon: LucideIcon; actionText?: string; onAction?: () => void; children: ReactNode }) {
    return (
        <section className="panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-[var(--oikos-cream)] p-2 text-[var(--oikos-green)]"><Icon size={18} /></div>
                    <div>
                        <h3 className="text-lg font-semibold">{title}</h3>
                    </div>
                </div>
                {actionText && onAction && <button className="rounded-full bg-[var(--oikos-yellow)] px-3 py-2 text-xs font-semibold text-[var(--oikos-burgundy)]" onClick={onAction}>
                    {actionText}
                </button>}
            </div>
            <div className="mt-4">{children}</div>
        </section>
    );
}

function AvatarChip({ member, compact = false }: { member: HouseMember; compact?: boolean }) {
    return (
        <div className={`flex items-center gap-2 rounded-full bg-[var(--oikos-cream)] ${compact ? "px-2 py-1" : "px-3 py-2"}`}>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--oikos-green)] text-xs font-semibold text-white">{member.avatar}</span>
            <span className="text-sm font-medium">{member.name}</span>
        </div>
    );
}

function MiniStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-[22px] bg-[var(--oikos-cream)] p-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--oikos-burgundy)]/55">{label}</p>
            <p className="mt-2 text-lg font-semibold">{value}</p>
        </div>
    );
}

function EmptyState({ text }: { text: string }) {
    return <div className="rounded-[24px] border border-dashed border-[rgba(40,0,3,0.15)] bg-[rgba(255,253,249,0.75)] px-5 py-7 text-center text-sm text-[var(--oikos-burgundy)]/70">{text}</div>;
}

function QuickActionRow({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
    return (
        <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl bg-[var(--oikos-cream)] px-4 py-3 text-left transition hover:bg-[rgba(242,208,169,0.7)]">
            <Icon size={18} className="text-[var(--oikos-green)]" />
            <span className="flex-1 text-sm font-medium">{label}</span>
            <ArrowRight size={16} className="text-[var(--oikos-burgundy)]/45" />
        </button>
    );
}

function nextTripLabel(startedAt: string) {
    return `Rozpoczęto ${formatShortTime(startedAt)}`;
}
