import { useState } from "react";
import { courses } from "../data/courses";
import { getCourseOverrides, setCourseOverride } from "../lib/courseOverrides";

export default function AdminCourses() {
  const [overrides, setOverrides] = useState(() => getCourseOverrides());

  function update(id: string, patch: { hidden?: boolean; title?: string }) {
    setCourseOverride(id, patch);
    setOverrides(getCourseOverrides());
  }

  if (courses.length === 0) {
    return <p className="text-sm">Course list yahan load nahi hui.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th scope="col" className="py-2 pr-4">Course</th>
            <th scope="col" className="py-2 pr-4">Title</th>
            <th scope="col" className="py-2 pr-4">Visibility</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((c) => {
            const o = overrides[c.id];
            const hidden = o?.hidden === true;
            return (
              <tr key={c.id} className="align-top">
                <td className="py-2 pr-4">
                  Class {c.classLevel} · {c.subject}
                </td>
                <td className="py-2 pr-4">
                  <input
                    key={o?.title ?? c.title}
                    className="input"
                    defaultValue={o?.title ?? c.title}
                    aria-label={`Title for ${c.id}`}
                    onBlur={(e) => {
                      const next = e.currentTarget.value.trim();
                      if (!next || next === (o?.title ?? c.title)) return;
                      update(c.id, { title: next });
                    }}
                  />
                </td>
                <td className="py-2 pr-4">
                  <button
                    type="button"
                    className="btn-ghost"
                    aria-label={`${hidden ? "Show" : "Hide"} course ${c.id}`}
                    onClick={() => update(c.id, { hidden: !hidden })}
                  >
                    {hidden ? "Show" : "Hide"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
