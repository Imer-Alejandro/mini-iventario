"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { KeyRound, Pencil, ShieldCheck, UserPlus, Users } from "lucide-react";

interface RoleOption {
  id: string;
  name: string;
}

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  roleId: string;
  role: { name: string };
  status: string;
}

interface PermissionOption {
  code: string;
  name: string;
  group: string;
}

interface ManagedRole extends RoleOption {
  description: string | null;
  permissions: string[];
  userCount: number;
}

async function fetchManagementData() {
  const [usersResponse, rolesResponse] = await Promise.all([
    fetch("/api/users", { cache: "no-store" }),
    fetch("/api/roles", { cache: "no-store" }),
  ]);
  const usersData = await usersResponse.json() as { users?: ManagedUser[]; roles?: RoleOption[]; error?: string };
  const rolesData = await rolesResponse.json() as { roles?: ManagedRole[]; permissions?: PermissionOption[]; error?: string };
  if (!usersResponse.ok) throw new Error(usersData.error || "No se pudieron cargar los usuarios.");
  if (!rolesResponse.ok) throw new Error(rolesData.error || "No se pudieron cargar los roles.");
  return {
    users: usersData.users || [],
    roles: rolesData.roles || [],
    permissions: rolesData.permissions || [],
  };
}

export default function UsersPage() {
  const [tab, setTab] = useState<"users" | "roles">("users");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<ManagedRole[]>([]);
  const [permissionOptions, setPermissionOptions] = useState<PermissionOption[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRoleId, setUserRoleId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setError("");
    try {
      const data = await fetchManagementData();
      setUsers(data.users);
      setRoles(data.roles);
      setPermissionOptions(data.permissions);
      setUserRoleId((current) => current || data.roles[0]?.id || "");
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los datos.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchManagementData()
      .then((data) => {
        if (!active) return;
        setUsers(data.users);
        setRoles(data.roles);
        setPermissionOptions(data.permissions);
        setUserRoleId((current) => current || data.roles[0]?.id || "");
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los datos.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function resetUserForm() {
    setUserId("");
    setUserName("");
    setUserEmail("");
    setUserPassword("");
    setUserRoleId(roles[0]?.id || "");
  }

  function editUser(user: ManagedUser) {
    setTab("users");
    setUserId(user.id);
    setUserName(user.name);
    setUserEmail(user.email);
    setUserRoleId(user.roleId);
    setUserPassword("");
    setNotice("");
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/users", {
        method: userId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(userId ? { id: userId } : {}),
          name: userName,
          email: userEmail,
          roleId: userRoleId,
          ...(userPassword ? { password: userPassword } : {}),
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "No se pudo guardar el usuario.");
      setNotice(userId ? "Usuario actualizado." : "Usuario creado.");
      resetUserForm();
      await loadData();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el usuario.");
    }
  }

  async function toggleUserStatus(user: ManagedUser) {
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, status: user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "No se pudo cambiar el estado.");
      setNotice(`Usuario ${user.status === "ACTIVE" ? "desactivado" : "activado"}.`);
      await loadData();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo cambiar el estado.");
    }
  }

  function editRole(role: ManagedRole) {
    setTab("roles");
    setRoleId(role.id);
    setRoleName(role.name);
    setRoleDescription(role.description || "");
    setRolePermissions(role.permissions);
    setNotice("");
  }

  async function saveRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/roles", {
        method: roleId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(roleId ? { id: roleId } : {}),
          name: roleName,
          description: roleDescription,
          permissions: rolePermissions,
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "No se pudo guardar el rol.");
      setNotice(roleId ? "Rol actualizado." : "Rol creado.");
      setRoleId("");
      setRoleName("");
      setRoleDescription("");
      setRolePermissions([]);
      await loadData();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el rol.");
    }
  }

  const permissionGroups = Array.from(new Set(permissionOptions.map(({ group }) => group)));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-bold text-emerald-700">
            <ShieldCheck className="h-4 w-4" /> Administración de accesos
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Usuarios y roles</h1>
          <p className="mt-1 text-sm text-slate-500">Crea cuentas y define qué acciones puede realizar cada rol.</p>
        </div>
      </header>

      <div className="flex gap-2 border-b border-slate-200">
        <button type="button" onClick={() => setTab("users")} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold ${tab === "users" ? "border-emerald-600 text-emerald-800" : "border-transparent text-slate-500"}`}>
          <Users className="h-4 w-4" /> Usuarios
        </button>
        <button type="button" onClick={() => setTab("roles")} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold ${tab === "roles" ? "border-emerald-600 text-emerald-800" : "border-transparent text-slate-500"}`}>
          <KeyRound className="h-4 w-4" /> Roles y permisos
        </button>
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p>}
      {isLoading ? (
        <div className="rounded-2xl bg-white/80 p-6 text-sm text-slate-500">Cargando usuarios y roles…</div>
      ) : tab === "users" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
          <section className="space-y-3">
            {users.map((user) => (
              <article key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white bg-white/85 p-4 shadow-sm">
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-900">{user.name}</p>
                  <p className="truncate text-sm text-slate-500">{user.email} · {user.role.name}</p>
                  <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${user.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                    {user.status === "ACTIVE" ? "Activo" : "Inactivo"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => editUser(user)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                  <button type="button" onClick={() => void toggleUserStatus(user)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                    {user.status === "ACTIVE" ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </article>
            ))}
            {users.length === 0 && <p className="rounded-2xl bg-white/80 p-6 text-sm text-slate-500">Aún no hay usuarios.</p>}
          </section>

          <form onSubmit={saveUser} className="h-fit space-y-4 rounded-2xl border border-white bg-white/90 p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-black text-slate-900"><UserPlus className="h-4 w-4" />{userId ? "Editar usuario" : "Crear usuario"}</h2>
            <label className="block space-y-1 text-sm font-semibold text-slate-700">Nombre
              <input required minLength={2} value={userName} onChange={(event) => setUserName(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" />
            </label>
            <label className="block space-y-1 text-sm font-semibold text-slate-700">Correo electrónico
              <input required type="email" value={userEmail} onChange={(event) => setUserEmail(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" />
            </label>
            <label className="block space-y-1 text-sm font-semibold text-slate-700">Rol
              <select required value={userRoleId} onChange={(event) => setUserRoleId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <option value="" disabled>Selecciona un rol</option>
                {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
              </select>
            </label>
            <label className="block space-y-1 text-sm font-semibold text-slate-700">
              {userId ? "Nueva contraseña (opcional)" : "Contraseña"}
              <input required={!userId} minLength={12} autoComplete="new-password" type="password" value={userPassword} onChange={(event) => setUserPassword(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" />
              <span className="text-xs font-normal text-slate-500">Mínimo 12 caracteres.</span>
            </label>
            <div className="flex gap-2">
              <button className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">{userId ? "Guardar cambios" : "Crear usuario"}</button>
              {userId && <button type="button" onClick={resetUserForm} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancelar</button>}
            </div>
          </form>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(380px,1.2fr)]">
          <section className="space-y-3">
            {roles.map((role) => (
              <article key={role.id} className="rounded-2xl border border-white bg-white/85 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{role.name}</p>
                    <p className="text-sm text-slate-500">{role.description || "Sin descripción"}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-500">{role.userCount} usuarios · {role.permissions.length} permisos</p>
                  </div>
                  <button type="button" onClick={() => editRole(role)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                </div>
              </article>
            ))}
          </section>

          <form onSubmit={saveRole} className="space-y-4 rounded-2xl border border-white bg-white/90 p-5 shadow-sm">
            <h2 className="font-black text-slate-900">{roleId ? "Editar rol y permisos" : "Crear rol"}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm font-semibold text-slate-700">Nombre del rol
                <input required minLength={2} value={roleName} onChange={(event) => setRoleName(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" />
              </label>
              <label className="block space-y-1 text-sm font-semibold text-slate-700">Descripción
                <input value={roleDescription} onChange={(event) => setRoleDescription(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" />
              </label>
            </div>
            <div className="space-y-4">
              {permissionGroups.map((group) => (
                <fieldset key={group} className="rounded-xl border border-slate-200 p-3">
                  <legend className="px-1 text-sm font-bold text-slate-800">{group}</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {permissionOptions.filter((permission) => permission.group === group).map((permission) => (
                      <label key={permission.code} className="flex items-start gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={rolePermissions.includes(permission.code)}
                          onChange={(event) => setRolePermissions((current) => event.target.checked
                            ? [...current, permission.code]
                            : current.filter((code) => code !== permission.code))}
                          className="mt-0.5 accent-emerald-600"
                        />
                        {permission.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">{roleId ? "Guardar rol" : "Crear rol"}</button>
              {roleId && <button type="button" onClick={() => { setRoleId(""); setRoleName(""); setRoleDescription(""); setRolePermissions([]); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancelar</button>}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
