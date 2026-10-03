/** Section not built yet — says when it arrives (todo.md). */
export function Placeholder({
  title,
  when,
  about,
}: {
  title: string;
  when: string;
  about: string;
}) {
  return (
    <>
      <div className="dash-head">
        <div>
          <h1>{title}</h1>
          <p className="dash-sub">{about}</p>
        </div>
      </div>
      <section className="card empty">
        <span className="chip chip-gold">Coming in {when}</span>
      </section>
    </>
  );
}
