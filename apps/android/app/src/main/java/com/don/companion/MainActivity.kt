package com.don.companion

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private lateinit var tvConnectionStatus: TextView
    private lateinit var tvDeviceDetails: TextView
    private lateinit var btnPair: Button
    private lateinit var btnTestNotification: Button
    private lateinit var btnOpenDialer: Button
    private lateinit var btnDirectCall: Button

    private val requestNotificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { isGranted ->
            if (isGranted) {
                Toast.makeText(this, "Notification permission granted for DON task alerts.", Toast.LENGTH_SHORT).show()
            }
        }

    private val requestCallPhonePermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { isGranted ->
            if (isGranted) {
                Toast.makeText(this, "CALL_PHONE permission granted. Direct calls enabled upon explicit confirmation.", Toast.LENGTH_SHORT).show()
                performDirectCall("555-0199")
            } else {
                Toast.makeText(this, "CALL_PHONE permission denied. Falling back to phone dialer proposal.", Toast.LENGTH_LONG).show()
                openPhoneDialer("555-0199")
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        tvConnectionStatus = findViewById(R.id.tvConnectionStatus)
        tvDeviceDetails = findViewById(R.id.tvDeviceDetails)
        btnPair = findViewById(R.id.btnPair)
        btnTestNotification = findViewById(R.id.btnTestNotification)
        btnOpenDialer = findViewById(R.id.btnOpenDialer)
        btnDirectCall = findViewById(R.id.btnDirectCall)

        checkPermissions()
        setupListeners()
    }

    override fun onResume() {
        super.onResume()
        updateDashboardState()
    }

    private fun checkPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestNotificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    private fun setupListeners() {
        btnPair.setOnClickListener {
            val intent = Intent(this, PairingActivity::class.java)
            startActivity(intent)
        }

        btnTestNotification.setOnClickListener {
            val intent = Intent(this, RelayService::class.java).apply {
                action = RelayService.ACTION_START_RELAY
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent)
            } else {
                startService(intent)
            }
            Toast.makeText(this, "Started DON Secure Relay service.", Toast.LENGTH_SHORT).show()
        }

        btnOpenDialer.setOnClickListener {
            openPhoneDialer("555-0199")
        }

        btnDirectCall.setOnClickListener {
            promptDirectCallWithConfirmation("555-0199")
        }
    }

    private fun updateDashboardState() {
        val prefs = getSharedPreferences("don_companion_prefs", Context.MODE_PRIVATE)
        val isPaired = prefs.getBoolean("is_paired", false)
        val deviceId = prefs.getString("device_id", "Unpaired") ?: "Unpaired"
        val serverUrl = prefs.getString("server_url", "Not configured") ?: "Not configured"

        if (isPaired) {
            tvConnectionStatus.text = "Connected & Paired"
            tvConnectionStatus.setTextColor(getColor(R.color.emerald_online))
            tvDeviceDetails.text = "Device ID: $deviceId\nEndpoint: $serverUrl\nMode: Local mDNS + Cloud Relay"
            btnPair.text = "Re-pair / Update Connection"
        } else {
            tvConnectionStatus.text = "Unpaired Companion"
            tvConnectionStatus.setTextColor(getColor(R.color.amber_primary))
            tvDeviceDetails.text = "Pair with DON web dashboard to receive task notifications & phone call proposals."
            btnPair.text = "Pair with DON Core"
        }
    }

    private fun openPhoneDialer(phoneNumber: String) {
        val dialIntent = Intent(Intent.ACTION_DIAL).apply {
            data = Uri.parse("tel:$phoneNumber")
        }
        startActivity(dialIntent)
    }

    private fun promptDirectCallWithConfirmation(phoneNumber: String) {
        AlertDialog.Builder(this)
            .setTitle("Confirm Outgoing Call Proposal")
            .setMessage("DON proposes to initiate a call to $phoneNumber.\n\nWi-Fi calling routing remains subject to carrier and system settings. Do you approve?")
            .setPositiveButton("Approve Call") { _, _ ->
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED) {
                    performDirectCall(phoneNumber)
                } else {
                    requestCallPhonePermissionLauncher.launch(Manifest.permission.CALL_PHONE)
                }
            }
            .setNegativeButton("Reject") { dialog, _ ->
                dialog.dismiss()
                Toast.makeText(this, "Call action rejected by user.", Toast.LENGTH_SHORT).show()
            }
            .show()
    }

    private fun performDirectCall(phoneNumber: String) {
        try {
            val callIntent = Intent(Intent.ACTION_CALL).apply {
                data = Uri.parse("tel:$phoneNumber")
            }
            startActivity(callIntent)
        } catch (e: SecurityException) {
            Toast.makeText(this, "Permission denied: Falling back to dialer.", Toast.LENGTH_SHORT).show()
            openPhoneDialer(phoneNumber)
        }
    }
}
