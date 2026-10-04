"use client";

import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { ConfirmButton, Drawer, useDrawer } from "@/components/drawer";
import type { Tables } from "@/lib/database.types";
import { colorVar, ROLES, roleName, TYPES, typeName } from "@/lib/roles";
import { saveTeamMember } from "../actions";

type Member = Tables<"team_members">;
type Division = Tables<"divisions">;

export function TeamView({
  team,
  divisions,
  canEdit,
}: {
  team: Member[];
  divisions: Division[];
  canEdit: boolean;
}) {
  const [q, setQ] = useState("");
  const [div, setDiv] = useState("");
  const [type, setType] = useState("");
  const drawer = useDrawer<Member>();
  const divById = (id: string | null) => divisions.find((d) => d.id === id);

  const needle = q.trim().toLowerCase();
  const rows = team.filter(
    (m) =>
      (!div || m.division_id === div) &&
      (!type || m.type === type) &&
      (!needle ||
        [m.name, m.title, m.responsibilities, m.email].some((v) =>
          String(v ?? "").toLowerCase().includes(needle),
        )),
  );

  return (
    <>
      <div className="toolbar">
        <input
          className="field-in search"
          type="search"
          placeholder="Search by name, title, or responsibility"
          aria-label="Search team"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="field-in"
          aria-label="Filter by division"
          value={div}
          onChange={(e) => setDiv(e.target.value)}
        >
          <option value="">All divisions</option>
          {divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          className="field-in"
          aria-label="Filter by type"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">All types</option>
          {TYPES.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        {canEdit && (
          <button type="button" className="btn primary" onClick={drawer.openNew}>
            Add team member
          </button>
        )}
      </div>

      {!team.length ? (
        <div className="empty">
          <h2>No one on the team yet</h2>
          <p>
            Add the people who run The ARK, from leads to facilitators to
            maintenance crews.
          </p>
          {canEdit && (
            <button type="button" className="btn primary" onClick={drawer.openNew}>
              Add the first team member
            </button>
          )}
        </div>
      ) : !rows.length ? (
        <div className="empty">
          <p>No one matches those filters.</p>
        </div>
      ) : (
        <>
          <div className="list">
            <div className="row head">
              <span>Person</span>
              <span className="c-div">Division</span>
              <span className="c-role">Access</span>
              <span className="c-type">Type</span>
              <span>Status</span>
            </div>
            {rows.map((m) => {
              const d = divById(m.division_id);
              const c = d ? colorVar(d.color) : "var(--slate)";
              return (
                <button
                  type="button"
                  className="row"
                  key={m.id}
                  onClick={() => drawer.openItem(m)}
                >
                  <span className="who">
                    <Avatar name={m.name} color={c} />
                    <span style={{ minWidth: 0 }}>
                      <b>{m.name}</b>
                      <span>{m.title || typeName(m.type)}</span>
                    </span>
                  </span>
                  <span className="c-div">
                    {d ? (
                      <span className="chip">
                        <i style={{ background: c }} />
                        {d.name}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </span>
                  <span className="c-role">{roleName(m.role)}</span>
                  <span className="c-type muted">{typeName(m.type)}</span>
                  <span className={`status ${m.status === "inactive" ? "off" : "on"}`}>
                    {m.status === "inactive" ? "Inactive" : "Active"}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="note">
            {rows.length} of {team.length} {team.length === 1 ? "person" : "people"}
          </p>
        </>
      )}

      <MemberDrawer
        key={drawer.item?.id ?? "new"}
        open={drawer.open}
        member={drawer.item}
        divisions={divisions}
        canEdit={canEdit}
        onClose={drawer.close}
      />
    </>
  );
}

function MemberDrawer({
  open,
  member,
  divisions,
  canEdit,
  onClose,
}: {
  open: boolean;
  member: Member | null;
  divisions: Division[];
  canEdit: boolean;
  onClose: () => void;
}) {
  const m = member;
  const edit = !!m;
  return (
    <Drawer
      title={!canEdit ? (m?.name ?? "") : edit ? "Edit team member" : "Add team member"}
      open={open}
      onClose={onClose}
      action={saveTeamMember}
      footer={
        canEdit ? (
          <>
            {edit && <ConfirmButton label="Remove" />}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary">
              {edit ? "Save changes" : "Add team member"}
            </button>
          </>
        ) : (
          <>
            <span className="spacer" />
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          </>
        )
      }
    >
      <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0 }}>
        {m && <input type="hidden" name="id" value={m.id} />}
        <div className="fld">
          <label htmlFor="m-name">Full name</label>
          <input id="m-name" name="name" defaultValue={m?.name} required autoComplete="off" />
        </div>
        <div className="fld">
          <label htmlFor="m-title">What they do</label>
          <input id="m-title" name="title" defaultValue={m?.title ?? ""} placeholder="e.g. Programming lead" />
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="m-type">Type</label>
            <select id="m-type" name="type" defaultValue={m?.type ?? "team"}>
              {TYPES.map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label htmlFor="m-div">Division</label>
            <select id="m-div" name="division_id" defaultValue={m?.division_id ?? ""}>
              <option value="">No division</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            {!divisions.length && <span className="hint">Add divisions in the Divisions tab.</span>}
          </div>
        </div>
        <div className="fld">
          <label htmlFor="m-role">Access level</label>
          <select id="m-role" name="role" defaultValue={m?.role ?? "lead"}>
            {ROLES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name} — {r.desc}
              </option>
            ))}
          </select>
        </div>
        <div className="fld">
          <label htmlFor="m-resp">Responsibilities</label>
          <textarea id="m-resp" name="responsibilities" defaultValue={m?.responsibilities ?? ""} placeholder="What they own day to day" />
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="m-email">Email</label>
            <input id="m-email" name="email" type="email" defaultValue={m?.email ?? ""} />
            <span className="hint">Only @theark.world addresses can sign in.</span>
          </div>
          <div className="fld">
            <label htmlFor="m-phone">WhatsApp</label>
            <input id="m-phone" name="phone" type="tel" defaultValue={m?.phone ?? ""} placeholder="+506 …" />
          </div>
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="m-start">Start date</label>
            <input id="m-start" name="start_date" type="date" defaultValue={m?.start_date ?? ""} />
          </div>
          <div className="fld">
            <label htmlFor="m-status">Status</label>
            <select id="m-status" name="status" defaultValue={m?.status ?? "active"}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        {m && (
          <p className="note" style={{ margin: 0 }}>
            {m.user_id ? "Has signed in to ARK OS." : "Hasn’t signed in yet."}
          </p>
        )}
      </fieldset>
    </Drawer>
  );
}
