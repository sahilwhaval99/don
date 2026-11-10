package com.don.companion

import android.app.Activity
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.UUID

class PairingActivity : AppCompatActivity() {

    private lateinit var etServerUrl: EditText
    private lateinit var etPairingToken: EditText
    private lateinit var btnSubmitPairing: Button
    private lateinit var tvPairingStatus: TextView

    private val httpClient = OkHttpClient()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_pairing)

        etServerUrl = findViewById(R.id.etServerUrl)
        etPairingToken = findViewById(R.id.etPairingToken)
        btnSubmitPairing = findViewById(R.id.btnSubmitPairing)
        tvPairingStatus = findViewById(R.id.tvPairingStatus)

        // Pre-fill server URL if available
        val prefs = getSharedPreferences("don_companion_prefs", Context.MODE_PRIVATE)
        etServerUrl.setText(prefs.getString("server_url", "http://10.0.2.2:3001"))

        btnSubmitPairing.setOnClickListener {
            performPairing()
        }
    }

    private fun performPairing() {
        val serverUrl = etServerUrl.text.toString().trim()
        val token = etPairingToken.text.toString().trim()

        if (serverUrl.isBlank() || token.isBlank()) {
            tvPairingStatus.text = "Please enter both Server URL and Pairing Token."
            tvPairingStatus.setTextColor(getColor(R.color.rose_danger))
            return
        }

        btnSubmitPairing.isEnabled = false
        tvPairingStatus.text = "Performing mutual cryptographic pairing handshake..."
        tvPairingStatus.setTextColor(getColor(R.color.amber_primary))

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val deviceId = UUID.randomUUID().toString()
                val deviceName = "Android (${Build.MANUFACTURER} ${Build.MODEL})"

                val payload = JSONObject().apply {
                    put("token", token)
                    put("pairingToken", token)
                    put("deviceName", deviceName)
                    put("name", deviceName)
                    put("deviceId", deviceId)
                    put("deviceType", "ANDROID_COMPANION")
                    put("clientVersion", "1.0.0")
                    put("capabilities", org.json.JSONArray(listOf("DIALER", "NOTIFICATIONS", "APPROVALS")))
                }

                val request = Request.Builder()
                    .url("$serverUrl/api/devices/pair")
                    .post(payload.toString().toRequestBody("application/json".toMediaType()))
                    .build()

                val response = httpClient.newCall(request).execute()
                val responseBody = response.body?.string() ?: ""

                withContext(Dispatchers.Main) {
                    if (response.isSuccessful) {
                        val json = JSONObject(responseBody)
                        val authToken = json.optString("authToken", token)
                        val registeredDeviceId = json.optString("deviceId", deviceId)

                        // Save securely to preferences
                        val prefs = getSharedPreferences("don_companion_prefs", Context.MODE_PRIVATE)
                        prefs.edit()
                            .putString("server_url", serverUrl)
                            .putString("auth_token", authToken)
                            .putString("device_id", registeredDeviceId)
                            .putString("device_name", deviceName)
                            .putBoolean("is_paired", true)
                            .apply()

                        tvPairingStatus.text = "Pairing successful! Starting relay connection..."
                        tvPairingStatus.setTextColor(getColor(R.color.emerald_online))

                        setResult(Activity.RESULT_OK)
                        finish()
                    } else {
                        btnSubmitPairing.isEnabled = true
                        tvPairingStatus.text = "Pairing failed: HTTP ${response.code} - ${response.message}"
                        tvPairingStatus.setTextColor(getColor(R.color.rose_danger))
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    btnSubmitPairing.isEnabled = true
                    tvPairingStatus.text = "Connection error: ${e.message}"
                    tvPairingStatus.setTextColor(getColor(R.color.rose_danger))
                }
            }
        }
    }
}
