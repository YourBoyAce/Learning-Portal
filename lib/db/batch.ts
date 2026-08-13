import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// ==========================================
// BATCH OPERATIONS
// ==========================================

export async function createBatch(
  name: string,
  courseId: string,
  createdBy: string,
  productId?: string,
) {
  try {
    const { data, error } = await supabase
      .from("batches")
      .insert({
        name,
        course_id: courseId,
        created_by: createdBy,
        ...(productId && { product_id: productId })
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function getAllBatches() {
  try {
    const { data, error } = await supabase
      .from("batches")
      .select(
        `
        *,
        courses:course_id (id, title),
        products:product_id (id, title),
        batch_members (id)
      `,
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function getBatchById(batchId: string) {
  try {
    const { data, error } = await supabase
      .from("batches")
      .select(
        `
        *,
        courses:course_id (id, title),
        products:product_id (id, title),
        batch_members (id, email, joined_at)
      `,
      )
      .eq("id", batchId)
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function updateBatch(
  batchId: string,
  updates: {
    name?: string;
    product_id?: string | null;
  },
) {
  try {
    const { data, error } = await supabase
      .from("batches")
      .update(updates)
      .eq("id", batchId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function deleteBatch(batchId: string) {
  try {
    const { error } = await supabase.from("batches").delete().eq("id", batchId);

    if (error) throw error;
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ==========================================
// BATCH MEMBERS OPERATIONS
// ==========================================

export async function addBatchMember(batchId: string, email: string) {
  try {
    const { data, error } = await supabase
      .from("batch_members")
      .insert({
        batch_id: batchId,
        email,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function getBatchMembers(batchId: string) {
  try {
    const { data, error } = await supabase
      .from("batch_members")
      .select("*")
      .eq("batch_id", batchId)
      .order("joined_at", { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function removeBatchMember(memberId: string) {
  try {
    const { error } = await supabase
      .from("batch_members")
      .delete()
      .eq("id", memberId);

    if (error) throw error;
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function addMultipleBatchMembers(
  batchId: string,
  emails: string[],
) {
  try {
    const members = emails.map((email) => ({
      batch_id: batchId,
      email,
    }));

    const { data, error } = await supabase
      .from("batch_members")
      .insert(members)
      .select();

    if (error) throw error;
    return { success: true, data };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ==========================================
// COURSES OPERATIONS
// ==========================================

export async function getAllCourses() {
  try {
    const { data, error } = await supabase
      .from("maincourses")
      .select("*")
      .order("title", { ascending: true });

    if (error) throw error;
    return { success: true, data };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
