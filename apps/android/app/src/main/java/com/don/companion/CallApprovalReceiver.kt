package com.don.companion

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.util.Log
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class CallApprovalReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "DonCallApproval"
        const val ACTION_APPROVE_CALL = "com.don.companion.ACTION_APPROVE_CALL"
        const val ACTION_REJECT_CALL = "com.don.companion.ACTION_REJECT_CALL"
        const val ACTION_APPROVE_TOOL = "com.don.companion.ACTION_APPROVE_TOOL"
        const val ACTION_REJECT_TOOL = "com.don.companion.ACTION_REJECT_TOOL"

        const val EXTRA_APPROVAL_ID = "extra_approval_id"
        const val EXTRA_PHONE_NUMBER = "extra_phone_number"
        const val EXTRA_DIRECT_CALL = "extra_direct_call"
        const val EXTRA_NOTIFICATION_ID = "extra_notification_id"
    }

    private val httpClient = OkHttpClient()

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        val approvalId = intent.getStringExtra(EXTRA_APPROVAL_ID) ?: ""
        val phoneNumber = intent.getStringExtra(EXTRA_PHONE_NUMBER) ?: ""
        val isDirectCall = intent.getBooleanExtra(EXTRA_DIRECT_CALL, false)
        val notifId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, 1001)

        // Dismiss the notification
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(notifId)

        when (action) {
            ACTION_APPROVE_CALL -> {
                Log.i(TAG, "Call proposal approved by user for phone: $phoneNumber")
                executeCallAction(context, phoneNumber, isDirectCall)
                sendResolution(context, approvalId, approved = true)
            }
            ACTION_REJECT_CALL -> {
                Log.i(TAG, "Call proposal explicitly rejected by user.")
                sendResolution(context, approvalId, approved = false)
            }
            ACTION_APPROVE_TOOL -> {
                Log.i(TAG, "Tool approval granted: $approvalId")
                sendResolution(context, approvalId, approved = true)
            }
            ACTION_REJECT_TOOL -> {
                Log.i(TAG, "Tool approval rejected: $approvalId")
                sendResolution(context, approvalId, approved = false)
            }
        }
    }

    private fun executeCallAction(context: Context, phoneNumber: String, directCall: Boolean) {
        try {
            val uri = Uri.parse("tel:$phoneNumber")
            if (directCall && ContextCompat.checkSelfPermission(context, android.Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED) {
                // Direct call when explicitly approved and CALL_PHONE permission granted
                val callIntent = Intent(Intent.ACTION_CALL, uri).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(callIntent)
            } else {
                // Safe dialer proposal - hands off to the user in dialer app without silent dialing
                val dialIntent = Intent(Intent.ACTION_DIAL, uri).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(dialIntent)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error executing call action: ${e.message}", e)
        }
    }

    private fun sendResolution(context: Context, approvalId: String, approved: Boolean) {
        if (approvalId.isBlank()) return

        val prefs = context.getSharedPreferences("don_companion_prefs", Context.MODE_PRIVATE)
        val serverUrl = prefs.getString("server_url", "https://api.don.internal") ?: "https://api.don.internal"
        val token = prefs.getString("auth_token", "") ?: ""

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val jsonPayload = """
                    {
                      "approvalId": "$approvalId",
                      "approved": $approved,
                      "decisionDevice": "ANDROID_COMPANION",
                      "timestamp": "${System.currentTimeMillis()}"
                    }
                """.trimIndent()

                val request = Request.Builder()
                    .url("$serverUrl/api/devices/relay/approval-response")
                    .addHeader("Authorization", "Bearer $token")
                    .post(jsonPayload.toRequestBody("application/json".toMediaType()))
                    .build()

                httpClient.newCall(request).execute().use { response ->
                    Log.d(TAG, "Approval resolution posted, code: ${response.code}")
                }
            } catch (e: Exception) {
                Log.w(TAG, "Could not send resolution back to server: ${e.message}")
            }
        }
    }
}
