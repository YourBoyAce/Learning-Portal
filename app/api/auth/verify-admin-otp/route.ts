import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";



export async function POST(req: Request) {


    try {


        const {
            userId,
            otp

        } = await req.json();



        if (!userId || !otp) {

            return NextResponse.json(
                {
                    success: false,
                    message: "Missing data"
                },
                {
                    status: 400
                }
            )

        }




        const {
            data,
            error

        } = await supabaseAdmin

            .from("admin_login_otps")

            .select("*")

            .eq(
                "user_id",
                userId
            )

            .eq(
                "otp_code",
                otp
            )

            .gt(
                "expires_at",
                new Date().toISOString()
            )

            .single();




        if (error || !data) {


            return NextResponse.json(

                {
                    success: false,
                    message: "Invalid or expired OTP"
                },

                {
                    status: 401
                }

            )

        }





        // OTP successful
        // Delete it

        await supabaseAdmin

            .from("admin_login_otps")

            .delete()

            .eq(
                "user_id",
                userId
            );





        return NextResponse.json({

            success: true,

            message: "OTP verified"

        });



    }

    catch (error) {


        console.log(
            "VERIFY OTP ERROR",
            error
        );


        return NextResponse.json(

            {
                success: false,
                message: "Verification failed"
            },

            {
                status: 500
            }

        )


    }


}