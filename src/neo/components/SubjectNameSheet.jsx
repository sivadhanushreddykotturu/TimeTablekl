import React, { useEffect, useState } from "react";
import { NeoModal } from "../Shell.jsx";
import { NeoField } from "../NeoKit.jsx";
import { getSubjectName, setSubjectName } from "../../utils/subjectMapper";

const MAX_LENGTH = 24;

/** Rename one course. `code` opens it; an empty name goes back to showing the course code. */
export default function SubjectNameSheet({ code, onClose, onSaved }) {
  const [draft, setDraft] = useState("");
  const named = code ? getSubjectName(code) !== code : false;

  useEffect(() => {
    setDraft(code && getSubjectName(code) !== code ? getSubjectName(code) : "");
  }, [code]);

  const save = (name) => {
    setSubjectName(code, name);
    onSaved?.();
    onClose();
  };

  return (
    <NeoModal open={Boolean(code)} title={code || ""} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save(draft);
        }}
      >
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
          {named && (
            <button type="button" className="np-btn np-btn--quiet" onClick={() => save("")}>
              Use code
            </button>
          )}
          <button type="submit" className="np-btn">Save</button>
        </div>
      </form>
    </NeoModal>
  );
}
