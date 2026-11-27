"use client";

import { FormEvent, useCallback, useEffect, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  Check,
  KeyRound,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  ShieldCheck,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";
import { ArchiveConfirmModal } from "@/app/components/ArchiveConfirmModal";

interface RoleOption {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
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

function SummaryCard({
  icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  helper: string;
  tone: string;
}) {
  return (
    <article className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <span className="mt-1 block text-2xl font-black tracking-tight text-slate-900">{value}</span>
        <span className="block truncate text-[10px] text-slate-400">{helper}</span>
      </span>
    </article>
  );
}

function getUserInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
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
  const [archiveUser, setArchiveUser] = useState<ManagedUser | null>(null);
  const [archiveRole, setArchiveRole] = useState<ManagedRole | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setError("");
    try {
      const data = await fetchManagementData();
      setUsers(data.users);
      setRoles(data.roles);
      setPermissionOptions(data.permissions);
      setUserRoleId((current) => current || data.roles.find((role) => role.status === "ACTIVE")?.id || "");
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
        setUserRoleId((current) => current || data.roles.find((role) => role.status === "ACTIVE")?.id || "");
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
    setUserRoleId(roles.find((role) => role.status === "ACTIVE")?.id || "");
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
    try {
      setIsArchiving(true);
      setArchiveError(null);
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, status: user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "No se pudo cambiar el estado.");
      setArchiveUser(null);
      setNotice(`Usuario ${user.status === "ACTIVE" ? "desactivado" : "activado"}.`);
      await loadData();
    } catch (saveError: unknown) {
      setArchiveError(saveError instanceof Error ? saveError.message : "No se pudo cambiar el estado.");
    } finally {
      setIsArchiving(false);
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

  async function toggleRoleStatus(role: ManagedRole) {
    try {
      setIsArchiving(true);
      setArchiveError(null);
      const response = await fetch("/api/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: role.id,
          name: role.name,
          description: role.description || "",
          permissions: role.permissions,
          status: role.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "No se pudo cambiar el estado del rol.");
      setArchiveRole(null);
      setNotice(`Rol ${role.status === "ACTIVE" ? "archivado" : "restaurado"}.`);
      await loadData();
    } catch (statusError: unknown) {
      setArchiveError(statusError instanceof Error ? statusError.message : "No se pudo cambiar el estado del rol.");
    } finally {
      setIsArchiving(false);
    }
  }

  const permissionGroups = Array.from(new Set(permissionOptions.map(({ group }) => group)));
  const activeUsers = users.filter((user) => user.status === "ACTIVE").length;
  const activeRoles = roles.filter((role) => role.status === "ACTIVE").length;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Administración de accesos
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Usuarios y roles</h1>
          <p className="mt-1.5 max-w-xl text-sm text-slate-500">
            Administra las cuentas del equipo y los permisos que controlan cada módulo.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
          <BadgeCheck className="h-4 w-4" />
          Acceso protegido
        </span>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-[88px] animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            icon={<Users className="h-5 w-5" />}
            label="Usuarios"
            value={users.length}
            helper="Cuentas registradas"
            tone="bg-blue-50 text-blue-700"
          />
          <SummaryCard
            icon={<UserRound className="h-5 w-5" />}
            label="Activos"
            value={activeUsers}
            helper={`${users.length - activeUsers} inactivos`}
            tone="bg-emerald-50 text-emerald-700"
          />
          <SummaryCard
            icon={<KeyRound className="h-5 w-5" />}
            label="Roles activos"
            value={activeRoles}
            helper={`${roles.length - activeRoles} archivados`}
            tone="bg-violet-50 text-violet-700"
          />
          <SummaryCard
            icon={<ShieldCheck className="h-5 w-5" />}
            label="Permisos"
            value={permissionOptions.length}
            helper="Disponibles para asignar"
            tone="bg-amber-50 text-amber-700"
          />
        </div>
      )}

      <div
        role="tablist"
        aria-label="Administración de usuarios y roles"
        onKeyDown={(event) => {
          let nextTab: "users" | "roles" | null = null;
          if (event.key === "ArrowRight" || event.key === "ArrowDown") {
            nextTab = tab === "users" ? "roles" : "users";
          } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            nextTab = tab === "roles" ? "users" : "roles";
          } else if (event.key === "Home") {
            nextTab = "users";
          } else if (event.key === "End") {
            nextTab = "roles";
          }
          if (!nextTab) return;
          event.preventDefault();
          setTab(nextTab);
          document.getElementById(`${nextTab}-tab`)?.focus();
        }}
        className="inline-flex max-w-full gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
      >
        <button
          id="users-tab"
          type="button"
          role="tab"
          aria-selected={tab === "users"}
          aria-controls="users-panel"
          tabIndex={tab === "users" ? 0 : -1}
          onClick={() => setTab("users")}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold transition sm:px-4 ${
            tab === "users" ? "bg-[#0B192C] text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Users className="h-4 w-4" />
          Usuarios
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${
            tab === "users" ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"
          }`}>{users.length}</span>
        </button>
        <button
          id="roles-tab"
          type="button"
          role="tab"
          aria-selected={tab === "roles"}
          aria-controls="roles-panel"
          tabIndex={tab === "roles" ? 0 : -1}
          onClick={() => setTab("roles")}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold transition sm:px-4 ${
            tab === "roles" ? "bg-[#0B192C] text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <KeyRound className="h-4 w-4" />
          Roles y permisos
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${
            tab === "roles" ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"
          }`}>{roles.length}</span>
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>
      )}
      {notice && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p>
      )}

      {isLoading ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
          <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          <div className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </div>
      ) : tab === "users" ? (
        <div id="users-panel" role="tabpanel" aria-labelledby="users-tab" className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]">
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3 px-1">
              <div>
                <h2 className="text-base font-bold text-slate-900">Equipo</h2>
                <p className="mt-0.5 text-xs text-slate-500">Cuentas y estado de acceso</p>
              </div>
              <span className="text-xs font-semibold text-slate-500">{users.length} cuentas</span>
            </div>
            {users.map((user) => (
              <article key={user.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${
                    user.status === "ACTIVE" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500"
                  }`}>
                    {getUserInitials(user.name)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="max-w-full truncate text-sm font-bold text-slate-900">{user.name}</h3>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        user.status === "ACTIVE" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          user.status === "ACTIVE" ? "bg-emerald-600" : "bg-slate-400"
                        }`} />
                        {user.status === "ACTIVE" ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{user.email}</p>
                    <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                      <KeyRound className="h-3 w-3" />
                      {user.role.name}
                    </span>
                  </div>
                </div>
                <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                  <button
                    type="button"
                    onClick={() => editUser(user)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 sm:flex-none"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => user.status === "ACTIVE"
                      ? (setArchiveError(null), setArchiveUser(user))
                      : void toggleUserStatus(user)}
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition sm:flex-none ${
                      user.status === "ACTIVE"
                        ? "border-rose-200 text-rose-700 hover:bg-rose-50"
                        : "border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                    }`}
                  >
                    {user.status === "ACTIVE" ? <Power className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    {user.status === "ACTIVE" ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </article>
            ))}
            {users.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <Users className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-700">Aún no hay usuarios</p>
                <p className="mt-1 text-xs text-slate-500">Crea una cuenta para dar acceso a otro miembro del equipo.</p>
              </div>
            )}
          </section>

          <form onSubmit={saveUser} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-6">
            <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                {userId ? <Pencil className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              </span>
              <div>
                <h2 className="font-bold text-slate-900">{userId ? "Editar usuario" : "Crear usuario"}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {userId ? "Actualiza los datos y el nivel de acceso." : "Agrega una cuenta y asígnale un rol activo."}
                </p>
              </div>
            </div>
            <label className="block space-y-1.5 text-xs font-bold text-slate-700">
              Nombre
              <input
                required
                minLength={2}
                autoComplete="name"
                placeholder="Nombre completo"
                value={userName}
                onChange={(event) => setUserName(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
              />
            </label>
            <label className="block space-y-1.5 text-xs font-bold text-slate-700">
              Correo electrónico
              <input
                required
                type="email"
                autoComplete="email"
                placeholder="nombre@negocio.com"
                value={userEmail}
                onChange={(event) => setUserEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
              />
            </label>
            <label className="block space-y-1.5 text-xs font-bold text-slate-700">
              Rol
              <select
                required
                value={userRoleId}
                onChange={(event) => setUserRoleId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
              >
                <option value="" disabled>Selecciona un rol</option>
                {roles.filter((role) => role.status === "ACTIVE" || role.id === userRoleId).map((role) => (
                  <option key={role.id} value={role.id}>{role.name}{role.status === "INACTIVE" ? " (inactivo)" : ""}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5 text-xs font-bold text-slate-700">
              {userId ? "Nueva contraseña (opcional)" : "Contraseña"}
              <input
                required={!userId}
                minLength={12}
                autoComplete="new-password"
                type="password"
                placeholder={userId ? "Deja en blanco para conservarla" : "Mínimo 12 caracteres"}
                value={userPassword}
                onChange={(event) => setUserPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
              />
              <span className="block text-[11px] font-normal text-slate-500">Mínimo 12 caracteres.</span>
            </label>
            <div className="flex gap-2 border-t border-slate-100 pt-4">
              <button className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800">
                {userId ? "Guardar cambios" : <><Plus className="h-4 w-4" /> Crear usuario</>}
              </button>
              {userId && (
                <button type="button" onClick={resetUserForm} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50">
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
      ) : (
        <div id="roles-panel" role="tabpanel" aria-labelledby="roles-tab" className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(420px,1.15fr)]">
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3 px-1">
              <div>
                <h2 className="text-base font-bold text-slate-900">Roles disponibles</h2>
                <p className="mt-0.5 text-xs text-slate-500">Agrupan permisos para asignarlos al equipo.</p>
              </div>
              <span className="text-xs font-semibold text-slate-500">{roles.length} roles</span>
            </div>
            {roles.map((role) => (
              <article key={role.id} className={`rounded-2xl border bg-white p-4 shadow-sm transition ${
                roleId === role.id ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-200 hover:border-slate-300"
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      role.status === "ACTIVE" ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-500"
                    }`}>
                      <KeyRound className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-slate-900">{role.name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          role.status === "ACTIVE" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"
                        }`}>
                          {role.status === "ACTIVE" ? "Activo" : "Archivado"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{role.description || "Sin descripción"}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold text-slate-500">
                        <span className="rounded-md bg-slate-100 px-2 py-1">{role.userCount} usuarios</span>
                        <span className="rounded-md bg-slate-100 px-2 py-1">{role.permissions.length} permisos</span>
                      </div>
                    </div>
                  </div>
                </div>
                {role.permissions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                    {role.permissions.slice(0, 3).map((code) => (
                      <span key={code} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-600">
                        {permissionOptions.find((permission) => permission.code === code)?.name || code}
                      </span>
                    ))}
                    {role.permissions.length > 3 && (
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">
                        +{role.permissions.length - 3} más
                      </span>
                    )}
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => editRole(role)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => role.status === "ACTIVE"
                      ? (setArchiveError(null), setArchiveRole(role))
                      : void toggleRoleStatus(role)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition ${
                      role.status === "ACTIVE"
                        ? "border-rose-200 text-rose-700 hover:bg-rose-50"
                        : "border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                    }`}
                  >
                    {role.status === "ACTIVE" ? <Power className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    {role.status === "ACTIVE" ? "Archivar" : "Restaurar"}
                  </button>
                </div>
              </article>
            ))}
            {roles.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <KeyRound className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-700">Aún no hay roles</p>
                <p className="mt-1 text-xs text-slate-500">Crea un rol para definir permisos reutilizables.</p>
              </div>
            )}
          </section>

          <form onSubmit={saveRole} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-6">
            <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <h2 className="font-bold text-slate-900">{roleId ? "Editar rol y permisos" : "Crear rol"}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">Elige exactamente qué áreas y acciones estarán habilitadas.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5 text-xs font-bold text-slate-700">
                Nombre del rol
                <input
                  required
                  minLength={2}
                  placeholder="Ej. Encargado de ventas"
                  value={roleName}
                  onChange={(event) => setRoleName(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
                />
              </label>
              <label className="block space-y-1.5 text-xs font-bold text-slate-700">
                Descripción
                <input
                  placeholder="Responsabilidades principales"
                  value={roleDescription}
                  onChange={(event) => setRoleDescription(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
                />
              </label>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Permisos por área</h3>
                <p className="mt-0.5 text-[11px] text-slate-500">Seleccionados: {rolePermissions.length}</p>
              </div>
              <span className="rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-bold text-violet-800">
                {permissionOptions.length} disponibles
              </span>
            </div>
            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {permissionGroups.map((group) => {
                const groupPermissions = permissionOptions.filter((permission) => permission.group === group);
                const selectedInGroup = groupPermissions.filter((permission) => rolePermissions.includes(permission.code)).length;
                return (
                  <fieldset key={group} className="rounded-xl border border-slate-200 p-3">
                    <legend className="px-1">
                      <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-800">
                        {group}
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                          {selectedInGroup}/{groupPermissions.length}
                        </span>
                      </span>
                    </legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {groupPermissions.map((permission) => {
                        const selected = rolePermissions.includes(permission.code);
                        return (
                          <label
                            key={permission.code}
                            className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-xs leading-5 transition ${
                              selected
                                ? "border-emerald-200 bg-emerald-50/70 text-emerald-950"
                                : "border-transparent bg-slate-50 text-slate-700 hover:border-slate-200 hover:bg-white"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(event) => setRolePermissions((current) => event.target.checked
                                ? [...current, permission.code]
                                : current.filter((code) => code !== permission.code))}
                              className="mt-1 accent-emerald-700"
                            />
                            <span className="min-w-0 flex-1">{permission.name}</span>
                            {selected && <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-700" />}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}
            </div>
            <div className="flex gap-2 border-t border-slate-100 pt-4">
              <button className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800">
                {roleId ? "Guardar rol" : <><Plus className="h-4 w-4" /> Crear rol</>}
              </button>
              {roleId && (
                <button
                  type="button"
                  onClick={() => {
                    setRoleId("");
                    setRoleName("");
                    setRoleDescription("");
                    setRolePermissions([]);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
      )}
      {archiveUser?.status === "ACTIVE" && (
        <ArchiveConfirmModal
          key={archiveUser.id}
          title="Desactivar usuario"
          entityLabel="Usuario"
          entityName={archiveUser.email}
          description="La cuenta perderá acceso al sistema. Su historial de actividad seguirá intacto y podrás reactivarla más adelante."
          confirmLabel="Confirmar desactivación"
          error={archiveError}
          isSubmitting={isArchiving}
          onClose={() => {
            if (!isArchiving) {
              setArchiveUser(null);
              setArchiveError(null);
            }
          }}
          onConfirm={() => void toggleUserStatus(archiveUser)}
        />
      )}
      {archiveRole?.status === "ACTIVE" && (
        <ArchiveConfirmModal
          key={archiveRole.id}
          title="Archivar rol"
          entityLabel="Rol"
          entityName={archiveRole.name}
          description="El rol dejará de estar disponible para asignarlo a nuevos usuarios. Sus permisos y registros se conservarán."
          blockedReason={archiveRole.userCount > 0
            ? `No se puede archivar porque ${archiveRole.userCount} usuario(s) todavía tienen asignado este rol. Cambia esos usuarios a otro rol primero.`
            : undefined}
          error={archiveError}
          isSubmitting={isArchiving}
          onClose={() => {
            if (!isArchiving) {
              setArchiveRole(null);
              setArchiveError(null);
            }
          }}
          onConfirm={() => void toggleRoleStatus(archiveRole)}
        />
      )}
    </div>
  );
}
