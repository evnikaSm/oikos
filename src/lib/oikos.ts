export type ContributionStatus = "paid" | "unpaid";
export type ShoppingItemState = "active" | "purchased";
export type TripStatus = "active" | "completed";
export type AssignmentStatus = "pending" | "completed";

export type HouseMember = {
    id: string;
    name: string;
    avatar: string;
    includeInCleaning: boolean;
    contributionAmount: number;
    contributionStatus: ContributionStatus;
    contributionPaidAt: string | null;
};

export type MonthlyBudget = {
    monthKey: string;
    currency: string;
    budgetAmount: number;
};

export type ShoppingItem = {
    id: string;
    name: string;
    quantity: string;
    estimatedPrice: number | null;
    creatorId: string;
    createdAt: string;
    state: ShoppingItemState;
    checked: boolean;
    purchasedTripId: string | null;
};

export type ShoppingTripItemSnapshot = {
    itemId: string;
    name: string;
    quantity: string;
    estimatedPrice: number | null;
    checkedAt: string | null;
};

export type ShoppingTrip = {
    id: string;
    purchaserId: string;
    startedAt: string;
    finishedAt: string | null;
    totalAmount: number | null;
    storeName: string;
    status: TripStatus;
    itemSnapshots: ShoppingTripItemSnapshot[];
    purchasedItemIds: string[];
};

export type GroceryExpense = {
    id: string;
    amount: number;
    note: string;
    purchaserId: string;
    createdAt: string;
    type: "manual" | "trip";
    tripId: string | null;
};

export type CleaningZone = {
    id: string;
    name: string;
    order: number;
};

export type CleaningAssignment = {
    id: string;
    weekKey: string;
    weekLabel: string;
    zoneId: string;
    zoneName: string;
    assignedMemberId: string | null;
    assignedMemberName: string;
    status: AssignmentStatus;
    completedAt: string | null;
    completedById: string | null;
    manualOverride: boolean;
};

export type OikosState = {
    house: {
        id: string;
        name: string;
        inviteToken: string;
        inviteLink: string;
        currency: string;
    };
    activeMemberId: string;
    monthlyBudget: MonthlyBudget;
    members: HouseMember[];
    shoppingItems: ShoppingItem[];
    shoppingTrips: ShoppingTrip[];
    groceryExpenses: GroceryExpense[];
    cleaningZones: CleaningZone[];
    cleaningAssignments: CleaningAssignment[];
    priceMemory: Record<string, number>;
    formerMembers?: Record<string, string>;
};

export const demoNow = new Date("2026-09-15T18:42:00");
export const demoMonthKey = formatMonthKey(demoNow);
export const demoWeekKeys = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(demoNow);
    date.setDate(demoNow.getDate() + index * 7 - 7);
    return formatWeekKey(date);
});

export const demoState: OikosState = {
    house: {
        id: "house_oikos_warsaw",
        name: "Oikos Warsaw",
        inviteToken: "join-oikos-warsaw-7f3c9d",
        inviteLink: "https://oikos.app/join/join-oikos-warsaw-7f3c9d",
        currency: "PLN",
    },
    activeMemberId: "anna",
    monthlyBudget: {
        monthKey: demoMonthKey,
        currency: "PLN",
        budgetAmount: 700,
    },
    members: [
        {
            id: "anna",
            name: "Anna",
            avatar: "A",
            includeInCleaning: true,
            contributionAmount: 250,
            contributionStatus: "paid",
            contributionPaidAt: "2026-09-01T09:12:00",
        },
        {
            id: "david",
            name: "David",
            avatar: "D",
            includeInCleaning: true,
            contributionAmount: 250,
            contributionStatus: "paid",
            contributionPaidAt: "2026-09-02T10:24:00",
        },
        {
            id: "mark",
            name: "Mark",
            avatar: "M",
            includeInCleaning: true,
            contributionAmount: 200,
            contributionStatus: "unpaid",
            contributionPaidAt: null,
        },
    ],
    shoppingItems: [
        {
            id: "item_milk",
            name: "Mleko",
            quantity: "2 L",
            estimatedPrice: 2.5,
            creatorId: "anna",
            createdAt: "2026-09-15T08:10:00",
            state: "active",
            checked: false,
            purchasedTripId: null,
        },
        {
            id: "item_eggs",
            name: "Jajka",
            quantity: "12",
            estimatedPrice: 4,
            creatorId: "david",
            createdAt: "2026-09-15T09:05:00",
            state: "active",
            checked: false,
            purchasedTripId: null,
        },
        {
            id: "item_rice",
            name: "Ryż",
            quantity: "1 kg",
            estimatedPrice: 3,
            creatorId: "anna",
            createdAt: "2026-09-15T10:20:00",
            state: "active",
            checked: false,
            purchasedTripId: null,
        },
        {
            id: "item_bananas",
            name: "Banany",
            quantity: "1 bunch",
            estimatedPrice: 3,
            creatorId: "mark",
            createdAt: "2026-09-14T19:05:00",
            state: "purchased",
            checked: true,
            purchasedTripId: "trip_lidl",
        },
        {
            id: "item_chicken",
            name: "Kurczak",
            quantity: "800 g",
            estimatedPrice: 8,
            creatorId: "david",
            createdAt: "2026-09-14T19:06:00",
            state: "purchased",
            checked: true,
            purchasedTripId: "trip_lidl",
        },
    ],
    shoppingTrips: [
        {
            id: "trip_lidl",
            purchaserId: "anna",
            startedAt: "2026-09-14T18:20:00",
            finishedAt: "2026-09-14T18:42:00",
            totalAmount: 46.8,
            storeName: "Lidl",
            status: "completed",
            itemSnapshots: [
                { itemId: "item_bananas", name: "Banany", quantity: "1 pęczek", estimatedPrice: 3, checkedAt: "2026-09-14T18:32:00" },
                { itemId: "item_chicken", name: "Kurczak", quantity: "800 g", estimatedPrice: 8, checkedAt: "2026-09-14T18:34:00" },
                { itemId: "item_yogurt", name: "Jogurt grecki", quantity: "500 g", estimatedPrice: 2.2, checkedAt: "2026-09-14T18:35:00" },
                { itemId: "item_tomatoes", name: "Pomidory", quantity: "4 szt.", estimatedPrice: 2.4, checkedAt: "2026-09-14T18:36:00" },
            ],
            purchasedItemIds: ["item_bananas", "item_chicken", "item_yogurt", "item_tomatoes"],
        },
        {
            id: "trip_pantry",
            purchaserId: "david",
            startedAt: "2026-09-10T17:15:00",
            finishedAt: "2026-09-10T17:46:00",
            totalAmount: 382.4,
            storeName: "Biedronka",
            status: "completed",
            itemSnapshots: [
                { itemId: "item_pasta", name: "Makaron", quantity: "6 opak.", estimatedPrice: 8.4, checkedAt: "2026-09-10T17:22:00" },
                { itemId: "item_oats", name: "Płatki owsiane", quantity: "3 opak.", estimatedPrice: 6.9, checkedAt: "2026-09-10T17:23:00" },
                { itemId: "item_soap", name: "Płyn do naczyń", quantity: "2 butelki", estimatedPrice: 5.2, checkedAt: "2026-09-10T17:27:00" },
            ],
            purchasedItemIds: ["item_pasta", "item_oats", "item_soap"],
        },
    ],
    groceryExpenses: [
        {
            id: "expense_trip_lidl",
            amount: 46.8,
            note: "Lidl",
            purchaserId: "anna",
            createdAt: "2026-09-14T18:42:00",
            type: "trip",
            tripId: "trip_lidl",
        },
        {
            id: "expense_trip_pantry",
            amount: 382.4,
            note: "Biedronka",
            purchaserId: "david",
            createdAt: "2026-09-10T17:46:00",
            type: "trip",
            tripId: "trip_pantry",
        },
        {
            id: "expense_manual_1",
            amount: 7.8,
            note: "Chleb i mleko",
            purchaserId: "david",
            createdAt: "2026-09-16T08:14:00",
            type: "manual",
            tripId: null,
        },
    ],
    cleaningZones: [
        { id: "zone_kitchen", name: "Kuchnia", order: 0 },
        { id: "zone_bathroom", name: "Łazienka", order: 1 },
        { id: "zone_living", name: "Salon", order: 2 },
    ],
    cleaningAssignments: buildDemoAssignments(),
    priceMemory: {
        Mleko: 2.5,
        Jajka: 4,
        Ryż: 3,
        Banany: 3,
        Kurczak: 8,
    },
};

function buildDemoAssignments(): CleaningAssignment[] {
    const members = [
        { id: "anna", name: "Anna" },
        { id: "david", name: "David" },
        { id: "mark", name: "Mark" },
    ];
    const zones = ["Kuchnia", "Łazienka", "Salon"];
    const weeks = [
        { key: "2026-W37", label: "Week 1" },
        { key: "2026-W38", label: "Week 2" },
        { key: "2026-W39", label: "Week 3" },
    ];
    const order = [
        [0, 1, 2],
        [0, 1, 2],
        [0, 1, 2],
    ];

    const assignments: CleaningAssignment[] = [];
    weeks.forEach((week, weekIndex) => {
        zones.forEach((zone, zoneIndex) => {
            const memberIndex = order[weekIndex][zoneIndex];
            const member = members[memberIndex];
            assignments.push({
                id: `${week.key}_${zoneIndex}`,
                weekKey: week.key,
                weekLabel: week.label,
                zoneId: ["zone_kitchen", "zone_bathroom", "zone_living"][zoneIndex],
                zoneName: zone,
                assignedMemberId: member.id,
                assignedMemberName: member.name,
                status: weekIndex === 0 && zoneIndex !== 0 ? "completed" : "pending",
                completedAt: weekIndex === 0 && zoneIndex !== 0 ? "2026-09-08T18:42:00" : null,
                completedById: weekIndex === 0 && zoneIndex !== 0 ? "anna" : null,
                manualOverride: false,
            });
        });
    });
    return assignments;
}

export function formatCurrency(amount: number, currency = "EUR") {
    return new Intl.NumberFormat("pl-PL", {
        style: "currency",
        currency,
        maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
}

export function formatShortTime(date: string | Date) {
    return new Intl.DateTimeFormat("pl-PL", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
    }).format(new Date(date));
}

export function formatLongDay(date: string | Date) {
    return new Intl.DateTimeFormat("pl-PL", {
        weekday: "long",
        day: "numeric",
        month: "long",
    }).format(new Date(date));
}

export function formatMonthKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function formatWeekKey(date: Date) {
    const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function createId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getMemberName(members: HouseMember[], memberId: string | null, formerMembers: Record<string, string> = {}) {
    return members.find((member) => member.id === memberId)?.name ?? (memberId ? formerMembers[memberId] : null) ?? "Wolne";
}

export function getActiveShoppingItems(items: ShoppingItem[]) {
    return items.filter((item) => item.state === "active");
}

export function getPurchasedShoppingItems(items: ShoppingItem[]) {
    return items.filter((item) => item.state === "purchased");
}

export function getShoppingEstimate(items: ShoppingItem[]) {
    return items
        .filter((item) => item.state === "active")
        .reduce((sum, item) => sum + (item.estimatedPrice ?? 0), 0);
}

export function getMonthlySpent(expenses: GroceryExpense[]) {
    return expenses.reduce((sum, expense) => sum + Math.round(expense.amount * 100), 0) / 100;
}

export function removeOwnExpense(state: OikosState, expenseId: string): OikosState {
    return { ...state, groceryExpenses: state.groceryExpenses.filter(expense =>
        expense.id !== expenseId || expense.purchaserId !== state.activeMemberId) };
}

export function getMonthlyContributed(members: HouseMember[]) {
    return members.reduce((sum, member) => sum + Math.round(member.contributionAmount * 100), 0) / 100;
}

export function getOutstandingContributors(members: HouseMember[]) {
    return members.filter((member) => member.contributionStatus === "unpaid");
}

export function getCleaningParticipants(members: HouseMember[]) {
    return members.filter((member) => member.includeInCleaning);
}

export function buildRotationSchedule({
    zones,
    members,
    startWeekDate,
    weeks = 8,
    existingAssignments = [],
}: {
    zones: CleaningZone[];
    members: HouseMember[];
    startWeekDate: Date;
    weeks?: number;
    existingAssignments?: CleaningAssignment[];
}) {
    const participating = members.filter((member) => member.includeInCleaning);
    if (!zones.length) return [] as CleaningAssignment[];

    const sortedZones = [...zones].sort((a, b) => a.order - b.order);
    const futureAssignments: CleaningAssignment[] = [];
    const protectedSlots = new Set(existingAssignments.map(a => `${a.weekKey}:${a.zoneId}`));
    const loads = new Map(participating.map(member => [member.id, 0]));
    const lastDutyWeek = new Map(participating.map(member => [member.id, ""]));
    const firstWeek = formatWeekKey(startWeekDate);
    const plannedWeeks = new Set(Array.from({ length: weeks }, (_, index) => {
        const date = new Date(startWeekDate);
        date.setDate(date.getDate() + index * 7);
        return formatWeekKey(date);
    }));
    for (const assignment of existingAssignments) {
        const memberId = assignment.assignedMemberId ?? "";
        if (assignment.weekKey < firstWeek && lastDutyWeek.has(memberId)
            && assignment.weekKey > lastDutyWeek.get(memberId)!) {
            lastDutyWeek.set(memberId, assignment.weekKey);
        }
        if (plannedWeeks.has(assignment.weekKey) && loads.has(assignment.assignedMemberId ?? "")) {
            const id = assignment.assignedMemberId!;
            loads.set(id, loads.get(id)! + 1);
        }
    }

    for (let weekIndex = 0; weekIndex < weeks; weekIndex += 1) {
        const weekDate = new Date(startWeekDate);
        weekDate.setDate(startWeekDate.getDate() + weekIndex * 7);
        const weekKey = formatWeekKey(weekDate);
        const weekLabel = `Week ${weekIndex + 1}`;
        const weeklyLoads = new Map(participating.map(member => [member.id,
            existingAssignments.filter(a => a.weekKey === weekKey && a.assignedMemberId === member.id).length]));
        for (const member of participating) {
            if (weeklyLoads.get(member.id)! > 0) lastDutyWeek.set(member.id, weekKey);
        }

        sortedZones.forEach((zone, zoneIndex) => {
            if (protectedSlots.has(`${weekKey}:${zone.id}`)) return;
            // Give everyone a turn this week before assigning a second zone.
            // History breaks workload ties so a new planning window continues the queue.
            const member = rotate(participating, (weekIndex + zoneIndex) % participating.length)
                .sort((a, b) => weeklyLoads.get(a.id)! - weeklyLoads.get(b.id)!
                    || loads.get(a.id)! - loads.get(b.id)!
                    || lastDutyWeek.get(a.id)!.localeCompare(lastDutyWeek.get(b.id)!))[0];
            if (member) {
                loads.set(member.id, loads.get(member.id)! + 1);
                weeklyLoads.set(member.id, weeklyLoads.get(member.id)! + 1);
                lastDutyWeek.set(member.id, weekKey);
            }
            futureAssignments.push({
                id: createId(`assign_${weekKey}_${zone.id}`),
                weekKey,
                weekLabel,
                zoneId: zone.id,
                zoneName: zone.name,
                assignedMemberId: member?.id ?? null,
                assignedMemberName: member?.name ?? "Rest",
                status: "pending",
                completedAt: null,
                completedById: null,
                manualOverride: false,
            });
        });
    }

    return futureAssignments;
}

function rotate<T>(items: T[], amount: number) {
    if (!items.length) return [];
    const normalized = amount % items.length;
    return [...items.slice(normalized), ...items.slice(0, normalized)];
}

export function canChangeCleaningCompletion(assignment: CleaningAssignment, memberId: string) {
    return (assignment.status === "completed" ? assignment.completedById : assignment.assignedMemberId) === memberId;
}

export function setCleaningCompletion(state: OikosState, assignmentId: string, completed: boolean, now = new Date()): OikosState {
    return { ...state, cleaningAssignments: state.cleaningAssignments.map(assignment => {
        if (assignment.id !== assignmentId || !canChangeCleaningCompletion(assignment, state.activeMemberId)
            || (assignment.status === "completed") === completed) return assignment;
        return { ...assignment, status: completed ? "completed" : "pending",
            completedAt: completed ? now.toISOString() : null,
            completedById: completed ? state.activeMemberId : null };
    }) };
}

/** Apply participation changes to the whole existing planning horizon. */
export function toggleCleaningParticipation(state: OikosState, memberId: string, now: Date, weeks = 8): OikosState {
    const next = { ...state, members: state.members.map(member => member.id === memberId
        ? { ...member, includeInCleaning: !member.includeInCleaning } : member) };
    const lastWeek = state.cleaningAssignments.reduce((last, a) => a.weekKey > last ? a.weekKey : last, formatWeekKey(now));
    for (let index = weeks; index < 52; index += 1) {
        const date = new Date(now);
        date.setDate(date.getDate() + index * 7);
        if (formatWeekKey(date) > lastWeek) break;
        weeks = index + 1;
    }
    return { ...next, cleaningAssignments: regenerateSchedule(next, now, weeks) };
}

/** Regenerate pending duties without losing history, completions or manual choices. */
export function removeRetiredZoneDuties(state: OikosState, now: Date) {
    const currentWeek = formatWeekKey(now);
    const activeZones = new Set(state.cleaningZones.map(zone => zone.id));
    return state.cleaningAssignments.filter(assignment => assignment.status !== "pending" || assignment.weekKey < currentWeek || activeZones.has(assignment.zoneId));
}

export function regenerateSchedule(state: OikosState, now: Date, weeks = 8, resetManualAssignments = false) {
    state = { ...state, cleaningAssignments: removeRetiredZoneDuties(state, now) };
    const currentWeek = formatWeekKey(now);
    const preserved = state.cleaningAssignments.filter(a => a.weekKey < currentWeek || a.status === "completed" || (a.manualOverride && !resetManualAssignments));
    const generated = buildRotationSchedule({ zones: state.cleaningZones, members: state.members, startWeekDate: now,
        weeks: Math.max(1, Math.min(52, Math.floor(weeks) || 8)), existingAssignments: preserved });
    const generatedSlots = new Set(generated.map(a => `${a.weekKey}:${a.zoneId}`));
    const outsideRange = state.cleaningAssignments.filter(a => !preserved.includes(a) && !generatedSlots.has(`${a.weekKey}:${a.zoneId}`));
    const existingSlots = new Map(state.cleaningAssignments.map(a => [`${a.weekKey}:${a.zoneId}`, a]));
    return [...preserved, ...outsideRange, ...generated.map(assignment => {
        const previous = existingSlots.get(`${assignment.weekKey}:${assignment.zoneId}`);
        return previous ? { ...previous, zoneName: assignment.zoneName,
            assignedMemberId: assignment.assignedMemberId, assignedMemberName: assignment.assignedMemberName,
            manualOverride: false } : assignment;
    })];
}

export function monthDays(month: Date) {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const length = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: Math.ceil((offset + length) / 7) * 7 }, (_, i) =>
        new Date(month.getFullYear(), month.getMonth(), 1 - offset + i));
}

/** PLN form input: accept Polish decimal commas, zero and at most two decimals. */
export function parseMoneyAmount(value: string): number | null {
    const normalized = value.trim().replace(",", ".");
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
    const amount = Number(normalized);
    return Number.isSafeInteger(Math.round(amount * 100)) ? amount : null;
}
