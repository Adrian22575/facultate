import { moduleClassNames } from "@/lib/ui/module-class-names";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { ADMIN_ROUTE_GROUPS } from "@/lib/admin-routes";

import overviewStyles from "./admin-overview.module.css";

export function AdminOverview() {
  return (
    <section className={moduleClassNames(overviewStyles, "admin-overview-grid")} aria-label="Zone administrative">
      {ADMIN_ROUTE_GROUPS.map((group, index) => (
        <article className={moduleClassNames(overviewStyles, "admin-overview-card")} key={group.id}>
          <span className={moduleClassNames(overviewStyles, "admin-overview-index")}>{String(index + 1).padStart(2, "0")}</span>
          <div className={moduleClassNames(overviewStyles, "admin-overview-card-head")}>
            <h2>{group.label}</h2>
            <p>{group.description}</p>
          </div>
          <ul>
            {group.routes.map((route) => (
              <li key={route.path}>
                <Link href={route.path}>
                  <span><strong>{route.label}</strong><small>{route.description}</small></span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
