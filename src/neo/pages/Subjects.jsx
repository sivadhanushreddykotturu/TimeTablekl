import React, { useMemo, useState } from "react";
import NeoShell, { NeoModal } from "../Shell.jsx";
import { NeoField } from "../NeoKit.jsx";
import { SettingsGroup, SettingsRow } from "../components/Settings.jsx";
import { extractMainCode } from "../../utils/subjectMapper";

const MAX_LENGTH = 24;

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}") || {};
  } catch {
    return {};
  }
}

/** Every course code that appears in the stored timetable. */
function coursesInTimetable() {
  const codes = new Set();
  Object.values(readJson("timetable")).forEach((day) => {
    Object.values(day || {}).forEach((slot) => {
      if (slot && slot !== "-") codes.add(extractMainCode(slot));
    });
  });
  return Array.from(codes).sort();
}

export default function NeoSubjects() {
  const [names, setNames] = useState(() => readJson("subjectMappings"));
  const [editing, setEditing] = useState(null); // course code being edited
  const [draft, setDraft] = useState("");
  const codes = useMemo(coursesInTimetable, []);

  const save = (next) => {
    setNames(next);
    localStorage.setItem("subjectMappings", JSON.stringify(next));
    setEditing(null);
  };

  const open = (code) => {
    setEditing(code);
    setDraft(names[code] || "");
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const name = draft.trim();
    if (name) {
      save({ ...names, [editing]: name });
    } else {
      // an empty name means "show the course code again"
      const { [editing]: _removed, ...rest } = names;
      save(rest);
    }
  };

  return (
    <NeoShell>
      <div className="np-pagehead">
        <h1 className="np-pagehead__title">Subject names</h1>
        <p className="np-pagehead__sub">
          Give a course a name you recognise. It replaces the code everywhere in the app.
        </p>
      </div>

      {codes.length === 0 ? (
        <div className="np-empty">
          <h2 className="np-empty__title">No courses yet</h2>
          <p className="np-empty__text">Sync your timetable from Today and your courses will show up here.</p>
        </div>
      ) : (
        <SettingsGroup>
          {codes.map((code) => (
            <SettingsRow
              key={code}
              icon={<span className="np-setrow__initial">{(names[code] || code).charAt(0).toUpperCase()}</span>}
              title={names[code] || code}
              description={names[code] ? code : "No name yet"}
              onClick={() => open(code)}
            />
          ))}
        </SettingsGroup>
      )}

      <NeoModal open={editing !== null} title={editing || ""} onClose={() => setEditing(null)}>
        <form onSubmit={handleSubmit}>
          <NeoField
            id="np-subject-name"
            label="Name"
            placeholder="e.g. Deep Learning"
            maxLength={MAX_LENGTH}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="np-modal__actions">
            {names[editing] && (
              <button
                type="button"
                className="np-btn np-btn--quiet"
                onClick={() => {
                  const { [editing]: _removed, ...rest } = names;
                  save(rest);
                }}
              >
                Use code
              </button>
            )}
            <button type="submit" className="np-btn">Save</button>
          </div>
        </form>
      </NeoModal>
    </NeoShell>
  );
}
