import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import {
  USER_FILTERS,
  type StaffUserRow,
  type UserFilter,
} from "@/lib/sanctions";
import { UserStatusBadges } from "./user-status";

// Users as staff see them (#80). Roles aren't readable through the API
// (#111), so the list comes from staff_list_users(), which checks staff
// itself. Moderators can look; only admins change anything (D-016).

const LIMIT = 100;

export default async function UsersPage(props: {
  searchParams?: Promise<{ q?: string; filter?: string }>;
}) {
  const searchParams = await props.searchParams;
  const query = searchParams?.q?.trim().slice(0, 100) ?? "";
  const filter: UserFilter =
    searchParams?.filter && Object.hasOwn(USER_FILTERS, searchParams.filter)
      ? (searchParams.filter as UserFilter)
      : "all";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_list_users", {
    p_search: query || null,
    p_filter: filter,
  });
  const users = (data ?? []) as StaffUserRow[];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Gebruikers</h2>
        <p className="text-sm text-muted-foreground">
          Zoek een gebruiker om de status te bekijken. Beheerders kunnen
          schorsen, de geverifieerd-badge toekennen en moderatoren aanstellen.
        </p>
      </div>

      <form
        role="search"
        action="/admin/gebruikers"
        className="flex flex-col gap-2 sm:flex-row"
      >
        <label htmlFor="user-search" className="sr-only">
          Zoek op gebruikersnaam
        </label>
        <Input
          id="user-search"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Zoek op gebruikersnaam of naam"
          maxLength={100}
          className="sm:flex-1"
        />
        <label htmlFor="user-filter" className="sr-only">
          Toon
        </label>
        <select
          id="user-filter"
          name="filter"
          defaultValue={filter}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs dark:bg-input/30"
        >
          {Object.entries(USER_FILTERS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Button type="submit">
          <Search className="h-4 w-4" aria-hidden />
          Zoeken
        </Button>
      </form>

      {error ? (
        <p className="text-destructive-text">
          De gebruikers konden niet geladen worden.
        </p>
      ) : users.length === 0 ? (
        <p className="text-muted-foreground">Geen gebruikers gevonden.</p>
      ) : (
        <ul className="divide-y rounded-md border" aria-label="Gebruikers">
          {users.map((user) => (
            <li key={user.id}>
              <Link
                href={`/admin/gebruikers/${user.id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 hover:bg-muted/50"
              >
                <span className="font-medium">{user.username}</span>
                {user.display_name && (
                  <span className="text-sm text-muted-foreground">
                    {user.display_name}
                  </span>
                )}
                <UserStatusBadges user={user} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {users.length === LIMIT && (
        <p className="text-xs text-muted-foreground">
          De eerste {LIMIT} gebruikers worden getoond. Zoek gerichter om de rest
          te vinden.
        </p>
      )}
    </div>
  );
}
