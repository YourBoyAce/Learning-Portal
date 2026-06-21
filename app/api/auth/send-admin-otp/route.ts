import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase-admin";


const resend = new Resend(
    process.env.RESEND_API_KEY
);


export async function POST(req: Request) {

    try {

        const {
            userId,
            email
        } = await req.json();



        if (!userId || !email) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Missing user details"
                },
                {
                    status: 400
                }
            );
        }



        // Generate 6 digit OTP

        const otp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();



        // Remove previous OTP

        await supabaseAdmin
            .from("admin_login_otps")
            .delete()
            .eq(
                "user_id",
                userId
            );



        // Insert new OTP

        const {
            error: insertError
        } = await supabaseAdmin
            .from("admin_login_otps")
            .insert({

                user_id: userId,

                email,

                otp_code: otp,

                expires_at:
                    new Date(
                        Date.now() + 5 * 60 * 1000
                    ).toISOString()

            });



        if (insertError) {

            console.log(
                "OTP insert error:",
                insertError
            );

            return NextResponse.json(
                {
                    success: false,
                    message: "Failed storing OTP"
                },
                {
                    status: 500
                }
            );
        }




        // Send Email

        await resend.emails.send({

            from:
                "onboarding@resend.dev",

            to:
                email,

            subject:
                "Admin Login OTP",

            html:
                `
      <h2>Your Admin Login OTP</h2>

      <h1>${otp}</h1>

      <p>
      This OTP expires in 5 minutes.
      </p>
      `
        });



        return NextResponse.json({

            success: true,

            message: "OTP sent successfully"

        });



    }
    catch (error) {

        console.log(
            "SEND OTP ERROR",
            error
        );


        return NextResponse.json(

            {
                success: false,
                message: "Failed to send OTP"
            },

            {
                status: 500
            }

        );

    }

}