import React, { useMemo, useState } from "react";
import NeoShell from "../Shell.jsx";
import { SettingsGroup, SettingsRow } from "../components/Settings.jsx";
import SubjectNameSheet from "../components/SubjectNameSheet.jsx";
import { extractMainCode } from "../../utils/subjectMapper";

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
  const [editing, setEditing] = useState(null); // course code being renamed
  const codes = useMemo(coursesInTimetable, []);

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
              onClick={() => setEditing(code)}
            />
          ))}
        </SettingsGroup>
      )}

      <SubjectNameSheet
        code={editing}
        onClose={() => setEditing(null)}
        onSaved={() => setNames(readJson("subjectMappings"))}
      />
    </NeoShell>
  );
}
