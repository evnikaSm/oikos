"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Check, CalendarDays, X } from "lucide-react";
import { formatLongDay, formatMonthKey, formatWeekKey, getMemberName, monthDays, type HouseMember, type OikosState } from "@/lib/oikos";

type Props = {
    state: OikosState; cleaningParticipants: HouseMember[];
    zoneName: string; scheduleWeeks: string;
    setZoneName: (value: string) => void; setScheduleWeeks: (value: string) => void;
    onRemoveZone: (id: string) => void;
    onAddZone: () => void; onRenameZone: (id: string, name: string) => void;
    onGenerateSchedule: (weeks?: number) => void; onRebalance: () => void;
    onToggleCleaningIncluded: (memberId: string) => void;
    onCompleteAssignment: (id: string) => void;
    onOverrideAssignmentMember: (id: string, memberId: string) => void;
};

export default function CleaningCalendar(props: Props) {
    const { state } = props;
    const [selected, setSelected] = useState(() => new Date());
    const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const touch = useRef<{ x: number; y: number } | null>(null);
    const swiped = useRef(false);
    const today = new Date();
    const days = monthDays(month);
    const weekKey = formatWeekKey(selected);
    const duties = state.cleaningAssignments.filter(a => a.weekKey === weekKey);
    const monthWeeks = new Set(days.filter(d => d.getMonth() === month.getMonth()).map(formatWeekKey));
    const monthDuties = state.cleaningAssignments.filter(a => monthWeeks.has(a.weekKey));
    const changeMonth = (delta: number) => {
        const next = new Date(month.getFullYear(), month.getMonth() + delta, 1);
        setMonth(next); setSelected(next);
    };
    const selectToday = () => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(today); };
    return <div className="space-y-5">
        <div className="page-heading"><p className="eyebrow">Wspólny dom · wspólna troska</p><h2>Sprzątanie</h2><p>Tygodniowy podział obowiązków w kalendarzu.</p></div>
        <section className="calendar panel" aria-label="Kalendarz sprzątania">
            <div className="calendar-toolbar">
                <button className="icon-button" aria-label="Poprzedni miesiąc" onClick={() => changeMonth(-1)}><ChevronLeft size={20} /></button>
                <h3 aria-live="polite">{new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" }).format(month)}</h3>
                <button className="icon-button" aria-label="Następny miesiąc" onClick={() => changeMonth(1)}><ChevronRight size={20} /></button>
            </div>
            <div className="calendar-summary"><span>{monthDuties.filter(a => a.status === "completed").length}/{monthDuties.length} wykonanych dyżurów</span><button className="text-button" onClick={selectToday}>Dzisiaj</button></div>
            <p className="calendar-hint">Przesuń w lewo: poprzedni miesiąc · w prawo: następny</p>
            <div className="calendar-swipe" onTouchStart={event => {
                swiped.current = false;
                if (event.touches.length !== 1) { touch.current = null; return; }
                touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
            }} onTouchCancel={() => { touch.current = null; }} onTouchEnd={event => {
                if (!touch.current) return;
                const dx = event.changedTouches[0].clientX - touch.current.x;
                const dy = event.changedTouches[0].clientY - touch.current.y;
                touch.current = null;
                if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) { swiped.current = true; changeMonth(dx < 0 ? -1 : 1); }
            }} onClickCapture={event => { if (swiped.current) { event.stopPropagation(); swiped.current = false; } }}>
                <div className="calendar-weekdays" aria-hidden="true">{["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map(d => <span key={d}>{d}</span>)}</div>
                <div className="calendar-grid">
                    {days.map(day => {
                        const assignments = state.cleaningAssignments.filter(a => a.weekKey === formatWeekKey(day));
                        const completed = assignments.filter(a => a.status === "completed").length;
                        const current = day.toDateString() === today.toDateString();
                        const picked = day.toDateString() === selected.toDateString();
                        return <button key={day.toISOString()} className={`calendar-day ${picked ? "selected" : ""} ${day.getMonth() !== month.getMonth() ? "outside" : ""}`}
                            aria-pressed={picked} aria-current={current ? "date" : undefined}
                            aria-label={`${formatLongDay(day)}: ${assignments.length} dyżurów w tygodniu, ${completed} wykonanych`}
                            onClick={() => { setSelected(day); if (day.getMonth() !== month.getMonth()) setMonth(new Date(day.getFullYear(), day.getMonth(), 1)); }}>
                            <span className={current ? "today-number" : ""}>{day.getDate()}</span>
                            {assignments.length > 0 && <span className="day-count">{completed === assignments.length ? "✓" : `${completed}/${assignments.length}`}</span>}
                        </button>;
                    })}
                </div>
            </div>
            <p className="calendar-hint">Licznik: wykonane / wszystkie dyżury tygodnia. Wybierz dzień, aby zobaczyć osoby i strefy.</p>
        </section>
        <section className="day-details" aria-label="Szczegóły wybranego dnia">
            <p className="eyebrow">{formatMonthKey(selected)} · {weekKey}</p>
            <h3>{formatLongDay(selected)}</h3>
            <p className="muted">Te dyżury obowiązują przez cały tydzień — wykonaj je w dowolnym dniu.</p>
            <div className="space-y-3 mt-4">{duties.length ? duties.map(assignment => <article key={assignment.id} className={`duty ${assignment.status === "completed" ? "done" : ""}`}>
                <div className="duty-heading"><div><h4>{assignment.zoneName}</h4><p>{assignment.assignedMemberName}</p></div>
                    <label className="completion-toggle"><input type="checkbox" checked={assignment.status === "completed"} disabled={assignment.status === "completed" || assignment.assignedMemberId !== state.activeMemberId} onChange={() => props.onCompleteAssignment(assignment.id)} /><span>{assignment.status === "completed" ? "Wykonano" : assignment.assignedMemberId === state.activeMemberId ? "Gotowe" : "Do wykonania"}</span></label>
                </div>
                {assignment.status === "completed" ? <p className="completion-time"><Check size={16} aria-hidden="true" /> {assignment.completedAt ? <time dateTime={assignment.completedAt}>{new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "long" }).format(new Date(assignment.completedAt))}</time> : "Brak daty wykonania"} · {getMemberName(state.members, assignment.completedById, state.formerMembers)}</p> : assignment.assignedMemberId === state.activeMemberId ? <label className="assignment-select"><span>Osoba odpowiedzialna{assignment.manualOverride ? " · zmiana ręczna" : ""}</span><select className="input" value={assignment.assignedMemberId ?? ""} onChange={e => props.onOverrideAssignmentMember(assignment.id, e.target.value)}><option value="">Nieprzypisane</option>{state.members.filter(m => m.includeInCleaning || m.id === assignment.assignedMemberId).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label> : <p className="muted mt-3">{assignment.assignedMemberId ? "Tylko przypisana osoba może ręcznie zmienić i potwierdzić ten dyżur." : "Dyżur czeka na przydział w automatycznej rotacji."}</p>}
            </article>) : <div className="empty-state"><CalendarDays size={28} /><h4>Brak dyżurów w tym tygodniu</h4><p>Sprawdź inny tydzień lub wygeneruj grafik w ustawieniach poniżej.</p></div>}</div>
        </section>
        <details className="settings-panel"><summary>Strefy i automatyczna rotacja <span>{state.cleaningZones.length} stref · {props.cleaningParticipants.length} osób</span></summary>
            <fieldset className="mt-4 space-y-2">
                <legend className="font-semibold">Uczestnicy sprzątania: {props.cleaningParticipants.length} z {state.members.length}</legend>
                {state.members.map(member => <label key={member.id} className="flex items-center gap-2">
                    <input type="checkbox" checked={member.includeInCleaning} onChange={() => props.onToggleCleaningIncluded(member.id)} />
                    <span>{member.name}</span>
                </label>)}
            </fieldset>
            <p className="muted mt-3">Zmiana uczestników automatycznie aktualizuje grafik i zachowuje ręczne przydziały. Przyciski „Generuj grafik” i „Wyrównaj przyszłe” rozdzielają od nowa wszystkie niewykonane dyżury w wybranym okresie od bieżącego tygodnia, także przydziały ręczne. Historia i wykonane zadania pozostają bez zmian.</p>
            <p className="muted mt-3">Jedna strefa to jedna osoba w tygodniu. Najpierw każdy otrzymuje jedną strefę, potem dzielimy pozostałe. Gdy osób jest więcej niż stref, kolejka przechodzi między wszystkimi uczestnikami w kolejnych tygodniach.</p>
            <form className="zone-form" onSubmit={e => { e.preventDefault(); props.onAddZone(); }}><label>Nowa strefa<input className="input" placeholder="np. Balkon" value={props.zoneName} onChange={e => props.setZoneName(e.target.value)} /></label><button className="btn-primary" disabled={!props.zoneName.trim()}>Dodaj strefę</button></form>
            <div className="zone-list">{state.cleaningZones.map(zone => <div key={`${zone.id}:${zone.name}`}>
                <div className="flex items-center gap-1">
                    <label htmlFor={`zone-name-${zone.id}`}>Strefa {zone.order + 1}</label>
                    <button type="button" className="zone-remove" aria-label={`Usuń strefę: ${zone.name}`} title="Usuń strefę" onClick={() => props.onRemoveZone(zone.id)}><X size={16} aria-hidden="true" /></button>
                </div>
                <input id={`zone-name-${zone.id}`} className="input" defaultValue={zone.name} onBlur={e => { const name = e.target.value.trim(); if (name && name !== zone.name) props.onRenameZone(zone.id, name); else e.target.value = zone.name; }} />
            </div>)}</div>
            <p className="muted mt-3">Usunięcie strefy usuwa jej niewykonane dyżury od bieżącego tygodnia. Historia i wykonane zadania pozostają bez zmian.</p>
            {!state.cleaningZones.length && <p className="muted mt-3">Brak stref. Dodaj pierwszą strefę, aby zaplanować sprzątanie.</p>}
            <div className="schedule-controls"><label>Okres grafiku<select className="input" value={props.scheduleWeeks} onChange={e => props.setScheduleWeeks(e.target.value)}><option value="4">4 tygodnie</option><option value="8">8 tygodni</option><option value="12">12 tygodni</option><option value="52">52 tygodnie</option></select></label><button className="btn-primary" disabled={!state.cleaningZones.length || !props.cleaningParticipants.length} onClick={() => props.onGenerateSchedule(Number(props.scheduleWeeks))}>Generuj grafik</button><button className="btn-secondary" disabled={!state.cleaningZones.length || !props.cleaningParticipants.length} onClick={props.onRebalance}>Wyrównaj przyszłe</button></div>
            {!props.cleaningParticipants.length && <p className="notice">Włącz przynajmniej jedną osobę do rotacji w zakładce Dom.</p>}
        </details>
    </div>;
}
