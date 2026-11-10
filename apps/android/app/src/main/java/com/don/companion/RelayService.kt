package com.don.companion

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class RelayService : Service() {

    companion object {
        private const val TAG = "DonRelayService"
        const val CHANNEL_ID_APPROVALS = "don_approvals_channel"
        const val CHANNEL_ID_NOTIFS = "don_notifications_channel"
        const val FOREGROUND_NOTIF_ID = 9001

        const val ACTION_START_RELAY = "com.don.companion.START_RELAY"
        const val ACTION_STOP_RELAY = "com.don.companion.STOP_RELAY"
    }

    private val serviceScope = CoroutineScope(Dispatchers.IO + Job())
    private var webSocket: WebSocket? = null
    private val httpClient = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP_RELAY -> {
                disconnectRelay()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
            ACTION_START_RELAY, null -> {
                startForeground(FOREGROUND_NOTIF_ID, createForegroundNotification())
                connectRelay()
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        disconnectRelay()
        serviceScope.cancel()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            val approvalsChannel = NotificationChannel(
                CHANNEL_ID_APPROVALS,
                "DON Consequential Approvals",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Urgent approval requests requiring user confirmation before action execution."
                enableVibration(true)
            }

            val notifsChannel = NotificationChannel(
                CHANNEL_ID_NOTIFS,
                "DON Task Reminders & Status",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Task updates, reminders, and daily briefing alerts."
            }

            notificationManager.createNotificationChannel(approvalsChannel)
            notificationManager.createNotificationChannel(notifsChannel)
        }
    }

    private fun createForegroundNotification() =
        NotificationCompat.Builder(this, CHANNEL_ID_NOTIFS)
            .setContentTitle("DON Companion Active")
            .setContentText("Connected to secure relay. Ready for phone approvals and reminders.")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

    private fun connectRelay() {
        val prefs = getSharedPreferences("don_companion_prefs", Context.MODE_PRIVATE)
        val serverUrl = prefs.getString("server_url", "http://10.0.2.2:3001") ?: "http://10.0.2.2:3001"
        val token = prefs.getString("auth_token", "") ?: ""

        val wsUrl = serverUrl.replace("https://", "wss://").replace("http://", "ws://") + "/api/devices/relay/ws"

        val request = Request.Builder()
            .url(wsUrl)
            .addHeader("Authorization", "Bearer $token")
            .build()

        webSocket = httpClient.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.i(TAG, "Connected to DON Cloud/mDNS Relay WebSocket.")
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                handleInboundRelayMessage(text)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.w(TAG, "WebSocket failure: ${t.message}. Retrying in 5 seconds...")
                serviceScope.launch {
                    delay(5000)
                    connectRelay()
                }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.i(TAG, "Relay WebSocket closed: $reason ($code)")
            }
        })
    }

    private fun disconnectRelay() {
        webSocket?.close(1000, "Service terminating")
        webSocket = null
    }

    private fun handleInboundRelayMessage(messageText: String) {
        try {
            val json = JSONObject(messageText)
            val type = json.optString("type")

            when (type) {
                "KILL_SWITCH_ACTIVE" -> {
                    Log.w(TAG, "EMERGENCY KILL SWITCH ENGAGED! Dismissing all notifications.")
                    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                    nm.cancelAll()
                }

                "APPROVAL_REQUEST", "DIAL_PROPOSAL" -> {
                    val approvalId = json.optString("approvalId")
                    val title = json.optString("title", "DON Approval Required")
                    val body = json.optString("body", "An action requires your explicit confirmation.")
                    val phoneNumber = json.optString("phoneNumber", "")
                    val isDirectCall = json.optBoolean("isDirectCall", false)

                    showApprovalNotification(
                        approvalId = approvalId,
                        title = title,
                        body = body,
                        phoneNumber = phoneNumber,
                        isDirectCall = isDirectCall
                    )
                }

                "TASK_REMINDER" -> {
                    val title = json.optString("title", "Task Reminder")
                    val body = json.optString("body", "")
                    showTaskNotification(title, body)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed parsing inbound relay message: ${e.message}", e)
        }
    }

    private fun showApprovalNotification(
        approvalId: String,
        title: String,
        body: String,
        phoneNumber: String,
        isDirectCall: Boolean
    ) {
        val notifId = (System.currentTimeMillis() % 10000).toInt()

        // Approve Intent
        val approveIntent = Intent(this, CallApprovalReceiver::class.java).apply {
            action = if (phoneNumber.isNotEmpty()) CallApprovalReceiver.ACTION_APPROVE_CALL else CallApprovalReceiver.ACTION_APPROVE_TOOL
            putExtra(CallApprovalReceiver.EXTRA_APPROVAL_ID, approvalId)
            putExtra(CallApprovalReceiver.EXTRA_PHONE_NUMBER, phoneNumber)
            putExtra(CallApprovalReceiver.EXTRA_DIRECT_CALL, isDirectCall)
            putExtra(CallApprovalReceiver.EXTRA_NOTIFICATION_ID, notifId)
        }
        val approvePendingIntent = PendingIntent.getBroadcast(
            this,
            notifId * 2,
            approveIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Reject Intent
        val rejectIntent = Intent(this, CallApprovalReceiver::class.java).apply {
            action = if (phoneNumber.isNotEmpty()) CallApprovalReceiver.ACTION_REJECT_CALL else CallApprovalReceiver.ACTION_REJECT_TOOL
            putExtra(CallApprovalReceiver.EXTRA_APPROVAL_ID, approvalId)
            putExtra(CallApprovalReceiver.EXTRA_NOTIFICATION_ID, notifId)
        }
        val rejectPendingIntent = PendingIntent.getBroadcast(
            this,
            notifId * 2 + 1,
            rejectIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID_APPROVALS)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .addAction(android.R.drawable.checkbox_on_background, "Approve", approvePendingIntent)
            .addAction(android.R.drawable.ic_delete, "Reject", rejectPendingIntent)
            .build()

        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(notifId, notification)
    }

    private fun showTaskNotification(title: String, body: String) {
        val notifId = (System.currentTimeMillis() % 10000).toInt()
        val notification = NotificationCompat.Builder(this, CHANNEL_ID_NOTIFS)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()

        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(notifId, notification)
    }
}
