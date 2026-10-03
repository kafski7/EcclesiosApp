import { CButton } from "@coreui/react";
import { useNavigate } from "react-router-dom";
import { Brand } from "@/components/brand";
import { signOut } from "@/lib/auth";
import { env } from "@/lib/env";

/** Signed in, but not an Administrator / Manager / Society-Leader anywhere (D-020). */
export function NoContextsPage({ name }: { name: string }) {
  const navigate = useNavigate();
  return (
    <main className="cms-auth">
      <div className="card cms-auth-card">
        <Brand dark={false} />
        <h1>No church to manage yet</h1>
        <p className="lede">
          {name}, Church Management is for church staff. When your parish or outstation gives you a
          role — Administrator, Manager or Society-Leader — it will appear here.
        </p>
        <a className="btn btn-primary btn-block mb-2" href={env.VITE_WEB_URL}>
          Go to Ecclesios
        </a>
        <CButton
          color="secondary"
          variant="ghost"
          className="btn-block"
          onClick={async () => {
            await signOut();
            navigate("/login", { replace: true });
          }}
        >
          Sign out
        </CButton>
      </div>
    </main>
  );
}
