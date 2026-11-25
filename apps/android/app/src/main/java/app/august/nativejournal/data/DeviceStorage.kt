package app.august.nativejournal.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

interface DeviceStorage {
    suspend fun read(): DeviceState
    suspend fun update(transform: (DeviceState) -> DeviceState): DeviceState
}

/** One encrypted, atomically replaced document. Tokens, account drafts and cached
 * entries never enter ordinary preferences, logs, or Android's cloud backup. */
class EncryptedDeviceStorage(context: Context) : DeviceStorage {
    private val file = AtomicFile(File(context.noBackupFilesDir, "august-v1.enc"))
    private val mutex = Mutex()
    private val alias = "august-device-v1"

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }

    private fun readFile(): DeviceState {
        if (!file.baseFile.exists() && !File(file.baseFile.path + ".bak").exists()) return DeviceState()
        val bytes = file.readFully()
        require(bytes.size > 29 && bytes[0] == 1.toByte()) { "Your saved journal data could not be opened." }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply {
            init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(1, 13)))
        }
        return AugustJson.decodeFromString(cipher.doFinal(bytes.copyOfRange(13, bytes.size)).toString(Charsets.UTF_8))
    }

    override suspend fun read(): DeviceState = withContext(Dispatchers.IO) { mutex.withLock { readFile() } }
    override suspend fun update(transform: (DeviceState) -> DeviceState): DeviceState = withContext(Dispatchers.IO) {
        mutex.withLock {
            val next = transform(readFile())
            val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
            val payload = byteArrayOf(1) + cipher.iv + cipher.doFinal(AugustJson.encodeToString(next).toByteArray(Charsets.UTF_8))
            val output = file.startWrite()
            try { output.write(payload); file.finishWrite(output) }
            catch (failure: Exception) { file.failWrite(output); throw failure }
            next
        }
    }
}
