/**
 * Minimal Database type. Replace with `supabase gen types typescript --local`
 * output once the project is linked to a Supabase instance. We use a permissive
 * shape here so the codebase stays moving without blocking on codegen.
 */
export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
