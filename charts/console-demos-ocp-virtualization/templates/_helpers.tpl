{{/*
Expand the name of the chart.
*/}}
{{- define "console-demos-ocp-virtualization.name" -}}
{{- if ne .Values.plugin.name "console-demos-ocp-virtualization" -}}
{{- fail "plugin.name must be console-demos-ocp-virtualization to match the plugin manifest" -}}
{{- end -}}
{{- .Values.plugin.name -}}
{{- end }}


{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "console-demos-ocp-virtualization.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "console-demos-ocp-virtualization.labels" -}}
helm.sh/chart: {{ include "console-demos-ocp-virtualization.chart" . }}
{{ include "console-demos-ocp-virtualization.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "console-demos-ocp-virtualization.selectorLabels" -}}
app: {{ include "console-demos-ocp-virtualization.name" . }}
app.kubernetes.io/name: {{ include "console-demos-ocp-virtualization.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/part-of: {{ include "console-demos-ocp-virtualization.name" . }}
{{- end }}

{{/*
Create the name secret containing the certificate
*/}}
{{- define "console-demos-ocp-virtualization.certificateSecret" -}}
{{ default (printf "%s-cert" (include "console-demos-ocp-virtualization.name" .)) .Values.plugin.certificateSecretName }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "console-demos-ocp-virtualization.serviceAccountName" -}}
{{- if .Values.plugin.serviceAccount.create }}
{{- default (include "console-demos-ocp-virtualization.name" .) .Values.plugin.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.plugin.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create the name of the patcher
*/}}
{{- define "console-demos-ocp-virtualization.patcherName" -}}
{{- printf "%s-patcher" (include "console-demos-ocp-virtualization.name" .) }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "console-demos-ocp-virtualization.patcherServiceAccountName" -}}
{{- if .Values.plugin.patcherServiceAccount.create }}
{{- default (printf "%s-patcher" (include "console-demos-ocp-virtualization.name" .)) .Values.plugin.patcherServiceAccount.name }}
{{- else }}
{{- default "default" .Values.plugin.patcherServiceAccount.name }}
{{- end }}
{{- end }}
