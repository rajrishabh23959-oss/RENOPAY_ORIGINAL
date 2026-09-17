package com.rishabh.renopay;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.CapacitorPlugin;

import android.os.Handler;
import android.os.Looper;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQUEST_CODE = 1001;
    private static final int SPEECH_REQUEST_CODE = 1002;

    private TextToSpeech textToSpeech;
    private boolean isTtsInitialized = false;
    private String pendingSpeakText = null;
    private String pendingSpeakLang = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(RenoTTSPlugin.class);
        super.onCreate(savedInstanceState);
        checkAndRequestAppPermissions();
        initTextToSpeech();
        setupJavascriptInterfaces();
    }

    @Override
    public void onStart() {
        super.onStart();
        setupJavascriptInterfaces();
    }

    @Override
    public void onResume() {
        super.onResume();
        setupJavascriptInterfaces();
    }

    private void checkAndRequestAppPermissions() {
        ArrayList<String> perms = new ArrayList<>();
        perms.add(Manifest.permission.CAMERA);
        perms.add(Manifest.permission.RECORD_AUDIO);
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
            perms.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
        }

        ArrayList<String> needed = new ArrayList<>();
        for (String perm : perms) {
            if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                needed.add(perm);
            }
        }
        if (!needed.isEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), PERMISSION_REQUEST_CODE);
        }
    }

    private void initTextToSpeech() {
        try {
            textToSpeech = new TextToSpeech(getApplicationContext(), status -> {
                if (status == TextToSpeech.SUCCESS) {
                    isTtsInitialized = true;
                    applyTtsLanguage("hi");

                    textToSpeech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                        @Override
                        public void onStart(String utteranceId) {
                            runOnUiThread(() -> {
                                if (getBridge() != null && getBridge().getWebView() != null) {
                                    getBridge().getWebView().evaluateJavascript(
                                        "window.__onSaathiSpeechStart && window.__onSaathiSpeechStart();", null
                                    );
                                }
                            });
                        }

                        @Override
                        public void onDone(String utteranceId) {
                            runOnUiThread(() -> {
                                if (getBridge() != null && getBridge().getWebView() != null) {
                                    getBridge().getWebView().evaluateJavascript(
                                        "window.__onSaathiSpeechEnd && window.__onSaathiSpeechEnd();", null
                                    );
                                }
                            });
                        }

                        @Override
                        public void onError(String utteranceId) {
                            runOnUiThread(() -> {
                                if (getBridge() != null && getBridge().getWebView() != null) {
                                    getBridge().getWebView().evaluateJavascript(
                                        "window.__onSaathiSpeechEnd && window.__onSaathiSpeechEnd();", null
                                    );
                                }
                            });
                        }
                    });

                    // If a speech request was made before TTS finished initializing
                    if (pendingSpeakText != null) {
                        final String queuedText = pendingSpeakText;
                        final String queuedLang = pendingSpeakLang;
                        pendingSpeakText = null;
                        pendingSpeakLang = null;
                        runOnUiThread(() -> speakText(queuedText, queuedLang));
                    }
                } else {
                    isTtsInitialized = false;
                }
            });
        } catch (Exception e) {
            isTtsInitialized = false;
        }
    }

    private void applyTtsLanguage(String lang) {
        if (textToSpeech == null) return;
        Locale targetLocale;
        if ("hi".equalsIgnoreCase(lang)) {
            targetLocale = new Locale("hi", "IN");
        } else if ("ta".equalsIgnoreCase(lang)) {
            targetLocale = new Locale("ta", "IN");
        } else if ("te".equalsIgnoreCase(lang)) {
            targetLocale = new Locale("te", "IN");
        } else if ("ml".equalsIgnoreCase(lang)) {
            targetLocale = new Locale("ml", "IN");
        } else {
            targetLocale = Locale.ENGLISH;
        }

        try {
            int result = textToSpeech.setLanguage(targetLocale);
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                // Fallback to English (India) or default English if Hindi/regional voice pack is not installed
                int fallbackResult = textToSpeech.setLanguage(new Locale("en", "IN"));
                if (fallbackResult == TextToSpeech.LANG_MISSING_DATA || fallbackResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                    textToSpeech.setLanguage(Locale.ENGLISH);
                }
            }
        } catch (Exception ignored) {
            try {
                textToSpeech.setLanguage(Locale.ENGLISH);
            } catch (Exception ignored2) {}
        }
    }

    public void speakText(String text, String lang) {
        if (text == null || text.trim().isEmpty()) return;

        if (!isTtsInitialized || textToSpeech == null) {
            pendingSpeakText = text;
            pendingSpeakLang = lang;
            initTextToSpeech();
            return;
        }

        try {
            applyTtsLanguage(lang);
            textToSpeech.setPitch(1.0f);
            textToSpeech.setSpeechRate(0.95f);

            Bundle params = new Bundle();
            params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f);

            String utteranceId = "Saathi_" + System.currentTimeMillis();
            textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, params, utteranceId);
        } catch (Exception e) {
            Toast.makeText(this, "Voice error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    public void stopSpeech() {
        if (textToSpeech != null) {
            textToSpeech.stop();
        }
    }

    public boolean isTtsReady() {
        return isTtsInitialized && textToSpeech != null;
    }

    public void startVoiceRecognition(String lang) {
        runOnUiThread(() -> {
            try {
                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                if ("hi".equalsIgnoreCase(lang)) {
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "hi-IN");
                } else if ("ta".equalsIgnoreCase(lang)) {
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ta-IN");
                } else if ("te".equalsIgnoreCase(lang)) {
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "te-IN");
                } else {
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN");
                }
                intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak to Saathi AI…");
                startActivityForResult(intent, SPEECH_REQUEST_CODE);
            } catch (Exception e) {
                Toast.makeText(this, "Voice recognition not available on this device", Toast.LENGTH_SHORT).show();
            }
        });
    }

    public void saveBase64ToDownloads(String base64Data, String filename, String mimeType) {
        if (filename == null || filename.trim().isEmpty()) {
            filename = "RenoPay_Document_" + System.currentTimeMillis();
        }
        if (mimeType == null || mimeType.trim().isEmpty()) {
            if (filename.toLowerCase().endsWith(".png")) {
                mimeType = "image/png";
            } else if (filename.toLowerCase().endsWith(".jpg") || filename.toLowerCase().endsWith(".jpeg")) {
                mimeType = "image/jpeg";
            } else {
                mimeType = "application/pdf";
            }
        }

        if (mimeType.contains("png") && !filename.toLowerCase().endsWith(".png")) {
            filename = filename + ".png";
        } else if ((mimeType.contains("jpg") || mimeType.contains("jpeg")) && !filename.toLowerCase().endsWith(".jpg")) {
            filename = filename + ".jpg";
        } else if (mimeType.contains("pdf") && !filename.toLowerCase().endsWith(".pdf")) {
            filename = filename + ".pdf";
        }

        final String finalFilename = filename;
        final String finalMimeType = mimeType;

        new Thread(() -> {
            try {
                byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);

                // 1. Save directly to Phone Downloads / RenoPay folder via MediaStore (Android 10+)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, finalFilename);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, finalMimeType);
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/RenoPay");
                    values.put(MediaStore.MediaColumns.IS_PENDING, 1);

                    ContentResolver resolver = getContentResolver();
                    Uri collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
                    Uri itemUri = resolver.insert(collection, values);

                    if (itemUri != null) {
                        try (OutputStream os = resolver.openOutputStream(itemUri)) {
                            if (os != null) {
                                os.write(fileBytes);
                                os.flush();
                            }
                        }
                        values.clear();
                        values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                        resolver.update(itemUri, values, null, null);
                    }
                } else {
                    // Legacy storage for Android 9 and lower
                    File publicDownloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    File renoPayDir = new File(publicDownloads, "RenoPay");
                    if (!renoPayDir.exists()) {
                        renoPayDir.mkdirs();
                    }
                    File legacyFile = new File(renoPayDir, finalFilename);
                    try (FileOutputStream fos = new FileOutputStream(legacyFile)) {
                        fos.write(fileBytes);
                        fos.flush();
                    }
                    sendBroadcast(new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE, Uri.fromFile(legacyFile)));
                }

                // 2. Also save to app-specific external files dir to reliably launch FileProvider ACTION_VIEW
                File appDownloads = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (appDownloads != null && !appDownloads.exists()) {
                    appDownloads.mkdirs();
                }
                File localFile = new File(appDownloads, finalFilename);
                try (FileOutputStream fos = new FileOutputStream(localFile)) {
                    fos.write(fileBytes);
                    fos.flush();
                }

                Uri contentUri = FileProvider.getUriForFile(
                    this,
                    getPackageName() + ".fileprovider",
                    localFile
                );

                runOnUiThread(() -> {
                    Toast.makeText(this, "✅ Saved to Phone Downloads: " + finalFilename, Toast.LENGTH_LONG).show();
                    try {
                        Intent viewIntent = new Intent(Intent.ACTION_VIEW);
                        viewIntent.setDataAndType(contentUri, finalMimeType);
                        viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        viewIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(Intent.createChooser(viewIntent, "Open " + finalFilename));
                    } catch (Exception ex) {
                        // Viewer app may not be present, file is safely in Downloads
                    }
                });

            } catch (Exception e) {
                final String errorMsg = e.getMessage();
                runOnUiThread(() -> {
                    Toast.makeText(this, "Could not save PDF: " + errorMsg, Toast.LENGTH_LONG).show();
                });
            }
        }).start();
    }

    private void setupJavascriptInterfaces() {
        int[] delays = {0, 300, 800, 1500};
        for (int delay : delays) {
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                try {
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        android.webkit.WebView wv = getBridge().getWebView();
                        wv.addJavascriptInterface(new AndroidDownloaderInterface(MainActivity.this), "AndroidDownloader");
                        wv.addJavascriptInterface(new AndroidTTSInterface(MainActivity.this), "AndroidTTS");
                        wv.addJavascriptInterface(new AndroidSTTInterface(MainActivity.this), "AndroidSTT");

                        // Inject Capacitor Plugin shim if window.AndroidTTS is not yet set
                        wv.evaluateJavascript(
                            "if (!window.AndroidTTS && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.RenoTTS) {" +
                            "  window.AndroidTTS = {" +
                            "    speak: function(t, l) { window.Capacitor.Plugins.RenoTTS.speak({text: t, lang: l}); }," +
                            "    stop: function() { window.Capacitor.Plugins.RenoTTS.stop(); }," +
                            "    isAvailable: function() { return true; }" +
                            "  };" +
                            "}", null
                        );
                    }
                } catch (Exception ignored) {}
            }, delay);
        }
    }

    // Capacitor Native Plugin for 100% Reliable Cross-Android Speech (Android 12, 13, 14, 15, 16)
    @CapacitorPlugin(name = "RenoTTS")
    public static class RenoTTSPlugin extends Plugin {
        @PluginMethod
        public void speak(PluginCall call) {
            String text = call.getString("text");
            String lang = call.getString("lang", "en");
            MainActivity activity = (MainActivity) getActivity();
            if (activity != null && text != null) {
                activity.runOnUiThread(() -> activity.speakText(text, lang));
                call.resolve();
            } else {
                call.reject("Activity or text missing");
            }
        }

        @PluginMethod
        public void stop(PluginCall call) {
            MainActivity activity = (MainActivity) getActivity();
            if (activity != null) {
                activity.runOnUiThread(activity::stopSpeech);
                call.resolve();
            } else {
                call.reject("Activity missing");
            }
        }

        @PluginMethod
        public void isAvailable(PluginCall call) {
            MainActivity activity = (MainActivity) getActivity();
            JSObject ret = new JSObject();
            ret.put("available", activity != null && activity.isTtsReady());
            call.resolve(ret);
        }
    }

    // Public Named Interfaces for WebView Reflection Security
    public static class AndroidDownloaderInterface {
        private final MainActivity activity;

        public AndroidDownloaderInterface(MainActivity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public void saveBase64File(String base64Data, String filename, String mimeType) {
            activity.saveBase64ToDownloads(base64Data, filename, mimeType);
        }
    }

    public static class AndroidTTSInterface {
        private final MainActivity activity;

        public AndroidTTSInterface(MainActivity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public void speak(String text, String lang) {
            activity.runOnUiThread(() -> activity.speakText(text, lang));
        }

        @JavascriptInterface
        public void stop() {
            activity.runOnUiThread(activity::stopSpeech);
        }

        @JavascriptInterface
        public boolean isAvailable() {
            return activity.isTtsReady();
        }
    }

    public static class AndroidSTTInterface {
        private final MainActivity activity;

        public AndroidSTTInterface(MainActivity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public void startListening(String lang) {
            activity.startVoiceRecognition(lang);
        }
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == SPEECH_REQUEST_CODE && resultCode == RESULT_OK && data != null) {
            ArrayList<String> results = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (results != null && !results.isEmpty()) {
                String spokenText = results.get(0).replace("'", "\\'").replace("\n", " ");
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().post(() -> {
                        getBridge().getWebView().evaluateJavascript(
                            "window.__onNativeSpeechResult && window.__onNativeSpeechResult('" + spokenText + "');",
                            null
                        );
                    });
                }
            }
        }
    }

    @Override
    public void onDestroy() {
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
        }
        super.onDestroy();
    }
}
