"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { withProfile } from "@/lib/db";
import { orNull } from "@/lib/form";

const schema = z.object({
  profile_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  full_name: z.string().min(2),
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().optional(),
  designation: z.string().optional(),
  department: z.string().optional(),
  manager_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  joining_date: z.string().optional(),
  employment_status: z.string().default("active"),
  salary: z.coerce.number().min(0).optional(),
  incentive_structure: z.string().optional(),
  notes: z.string().optional(),
});

type StaffInput = z.infer<typeof schema>;

/** Drops blanks and the "__none__" sentinel the optional Selects submit. */
function parseStaffForm(formData: FormData): Record<string, string> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  Object.keys(raw).forEach((k) => {
    if (raw[k] === "" || raw[k] === "__none__") delete raw[k];
  });
  return raw;
}

function staffColumns(parsed: StaffInput) {
  return {
    profile_id: orNull(parsed.profile_id),
    full_name: parsed.full_name,
    email: orNull(parsed.email),
    phone: orNull(parsed.phone),
    designation: orNull(parsed.designation),
    department: orNull(parsed.department),
    manager_id: orNull(parsed.manager_id),
    joining_date: orNull(parsed.joining_date),
    employment_status: parsed.employment_status,
    salary: orNull(parsed.salary),
    incentive_structure: orNull(parsed.incentive_structure),
    notes: orNull(parsed.notes),
  };
}

export async function createStaff(formData: FormData) {
  const { profile } = await requirePermission("staff", "create");
  const parsed = schema.parse(parseStaffForm(formData));

  const id = await withProfile(profile.id, async (trx) => {
    const row = await trx
      .insertInto("staff")
      .values(staffColumns(parsed))
      .returning("id")
      .executeTakeFirstOrThrow();
    return row.id;
  });

  revalidatePath("/staff");
  redirect(`/staff/${id}`);
}

export async function updateStaff(id: string, formData: FormData) {
  const { profile } = await requirePermission("staff", "edit");
  const parsed = schema.parse(parseStaffForm(formData));

  await withProfile(profile.id, async (trx) => {
    // A staff member cannot report to themselves.
    if (parsed.manager_id === id) throw new Error("A staff member cannot be their own manager.");

    await trx.updateTable("staff").set(staffColumns(parsed)).where("id", "=", id).execute();
  });

  revalidatePath(`/staff/${id}`);
  revalidatePath("/staff");
}
