import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    /*
     * Client using the caller's JWT.
     */
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: "Missing authorization.",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    const {
      data: { user: currentUser },
      error: currentUserError,
    } = await userClient.auth.getUser();

    if (currentUserError || !currentUser) {
      return new Response(
        JSON.stringify({
          error: "You must be logged in.",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    /*
     * Service-role client.
     * NEVER expose this key in frontend code.
     */
    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    /*
     * Verify caller is Super Admin.
     */
    const { data: callerProfile, error: callerProfileError } =
      await adminClient
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", currentUser.id)
        .single();

    if (
      callerProfileError ||
      !callerProfile ||
      callerProfile.role !== "super_admin"
    ) {
      return new Response(
        JSON.stringify({
          error: "Only the Super Admin can create barangay admin accounts.",
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const body = await req.json();

    const fullName = String(body.full_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const barangayId = String(body.barangay_id || "").trim();

    if (!fullName) {
      throw new Error("Full name is required.");
    }

    if (!email) {
      throw new Error("Email address is required.");
    }

    if (!password || password.length < 8) {
      throw new Error(
        "Password must contain at least 8 characters."
      );
    }

    if (!barangayId) {
      throw new Error("Barangay is required.");
    }

    /*
     * Verify barangay exists and is active.
     */
    const { data: barangay, error: barangayError } =
      await adminClient
        .from("barangays")
        .select("id, name, is_active")
        .eq("id", barangayId)
        .single();

    if (
      barangayError ||
      !barangay ||
      !barangay.is_active
    ) {
      throw new Error("Selected barangay is invalid or inactive.");
    }

    /*
     * Prevent duplicate Barangay Admin for the same barangay.
     */
    const { data: existingAdmin } = await adminClient
      .from("profiles")
      .select("id, full_name, role, barangay_id")
      .eq("barangay_id", barangayId)
      .eq("role", "admin")
      .maybeSingle();

    if (existingAdmin) {
      throw new Error(
        `${barangay.name} already has a Barangay Admin account.`
      );
    }

    /*
     * Create Auth account.
     */
    const {
      data: createdUser,
      error: createUserError,
    } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: "admin",
        barangay_id: barangayId,
      },
    });

    if (createUserError || !createdUser.user) {
      throw new Error(
        createUserError?.message ||
          "Unable to create authentication account."
      );
    }

    /*
     * Create profile.
     */
    const { error: profileError } =
      await adminClient
        .from("profiles")
        .insert({
          id: createdUser.user.id,
          full_name: fullName,
          role: "admin",
          barangay_id: barangayId,
          organization_id: barangay.organization_id,
          verification_status: "verified",
        });

    if (profileError) {
      /*
       * Roll back Auth account if profile creation fails.
       */
      await adminClient.auth.admin.deleteUser(
        createdUser.user.id
      );

      throw new Error(
        `Account was not created because the profile could not be saved: ${profileError.message}`
      );
    }

    /*
     * Audit log.
     */
    await adminClient
      .from("audit_logs")
      .insert({
        user_id: currentUser.id,
        action: "Created barangay admin",
        module: "Users",
        details:
          `Created admin account for ${barangay.name}: ${email}`,
        public_visible: false,
        admin_name: callerProfile.full_name || "Super Admin",
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Barangay Admin account created successfully for ${barangay.name}.`,
        admin: {
          id: createdUser.user.id,
          full_name: fullName,
          email,
          role: "admin",
          barangay_id: barangay.id,
          barangay_name: barangay.name,
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong.",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});