package app.august.nativejournal.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

val AugustJson = Json { ignoreUnknownKeys = true; encodeDefaults = true; explicitNulls = false }
// Database fields such as tags can be null in older entries. Only API data uses
// defaults for these values; encrypted storage and authentication stay strict.
val ServerJson = Json(AugustJson) { coerceInputValues = true }

@Serializable
data class AuthConfig(val supabaseUrl: String, val supabaseAnonKey: String, val googleEnabled: Boolean)
@Serializable
data class Connection(val server: String, val config: AuthConfig)
@Serializable
data class Account(val id: String, val email: String = "")
@Serializable
data class Session(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String,
    @SerialName("expires_at") val expiresAt: Long = 0,
    @SerialName("expires_in") val expiresIn: Long = 3600,
    val user: Account,
)
@Serializable
data class AuthAttempt(val verifier: String, val state: String, val createdAt: Long)
@Serializable
data class NoteSubmission(val content: String, val key: String, val currentTime: String, val timezone: String)
@Serializable
data class Draft(val content: String = "", val pending: NoteSubmission? = null)
@Serializable
data class Memory(val title: String = "")
@Serializable
data class Moment(
    val id: String,
    val content: String,
    val category: String,
    val tags: List<String> = emptyList(),
    @SerialName("event_timestamp") val eventTimestamp: String,
    @SerialName("created_at") val createdAt: String,
    val memory: Memory? = null,
)
@Serializable
data class ItemsResponse(val items: List<Moment>)
@Serializable
data class SaveResponse(val success: Boolean, val noteId: String, val extractedCount: Int)
@Serializable
data class Insight(
    val title: String,
    val meaning: String,
    val takeaway: String,
    @SerialName("source_ids") val sourceIds: List<String> = emptyList(),
)
@Serializable
data class Reflection(
    val opening: String,
    val focus: Insight? = null,
    val progress: List<Insight> = emptyList(),
    val experiences: List<Insight> = emptyList(),
    val lessons: List<Insight> = emptyList(),
    val patterns: List<Insight> = emptyList(),
    @SerialName("next_step") val nextStep: Insight? = null,
    val question: String = "",
)
@Serializable
data class ReviewIntention(
    @SerialName("anchor_id") val anchorId: String,
    val title: String,
    val kind: String = "goal",
    val status: String = "open",
    val reflection: String = "",
    val gap: String = "",
    @SerialName("next_step") val nextStep: String = "",
    @SerialName("source_ids") val sourceIds: List<String> = emptyList(),
    val deadline: String? = null,
)
@Serializable
data class ReviewResponse(
    val status: String,
    val message: String? = null,
    val review: Reflection? = null,
    val entries: List<Moment> = emptyList(),
    @SerialName("selected_count") val selectedCount: Int = 0,
    val intentions: List<ReviewIntention> = emptyList(),
)
@Serializable
data class GraphNode(val id: String, val name: String, val group: String, val color: String, val tags: List<String> = emptyList())
@Serializable
data class GraphLink(val source: String, val target: String, val weight: Double, @SerialName("link_type") val type: String)
@Serializable
data class GraphResponse(val nodes: List<GraphNode> = emptyList(), val links: List<GraphLink> = emptyList())

@Serializable
data class JournalTask(
    val id: String, val title: String, val content: String,
    @SerialName("due_at") val dueAt: String? = null,
    val completed: Boolean = false,
    @SerialName("completed_at") val completedAt: String? = null,
    @SerialName("updated_at") val updatedAt: String,
    @SerialName("created_at") val createdAt: String,
    val tags: List<String> = emptyList(),
)
@Serializable data class TasksResponse(val tasks: List<JournalTask>)
@Serializable data class TaskMutation(val task: JournalTask)

@Serializable
data class ServiceCheck(val ready: Boolean, val message: String)
@Serializable
data class ServerStatus(val journal: ServiceCheck, val graph: ServiceCheck, val review: ServiceCheck)

@Serializable
data class DeviceState(
    val connection: Connection? = null,
    val session: Session? = null,
    val authAttempt: AuthAttempt? = null,
    val drafts: Map<String, Draft> = emptyMap(),
    val cachedMoments: Map<String, List<Moment>> = emptyMap(),
    val cachedTasks: Map<String, List<JournalTask>> = emptyMap(),
    val taskSyncAt: Map<String, Long> = emptyMap(),
    val taskRemindersEnabled: Boolean = true,
    val deliveredTaskReminders: Set<String> = emptySet(),
    val appearance: String = "system",
)

fun DeviceState.accountKey(): String? = session?.let { "${connection?.server}|${connection?.config?.supabaseUrl}|${it.user.id}" }
