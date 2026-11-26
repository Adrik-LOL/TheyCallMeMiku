import argparse
import base64
import os
import shutil
import subprocess
import sys
import tempfile
import uuid
import wave
from pathlib import Path


ROOT = Path(__file__).resolve().parent
RVC_ROOT = ROOT / "Retrieval-based-Voice-Conversion-WebUI"
RVC_MODEL = ROOT / "miku" / "miku_power_rvc.pth"
GENERATED_AUDIO = ROOT / "generated-audio"


def find_ffmpeg():
    configured_path = os.environ.get("FFMPEG_PATH")
    if configured_path:
        candidate = Path(configured_path).expanduser().resolve()
        if candidate.is_file():
            return str(candidate)
        raise FileNotFoundError(f"FFMPEG_PATH non esiste: {candidate}")

    executable = shutil.which("ffmpeg")
    if executable:
        return executable
    raise FileNotFoundError(
        "FFmpeg non trovato. Aggiungi ffmpeg.exe al PATH o imposta FFMPEG_PATH."
    )


def find_rvc_python():
    configured_path = os.environ.get("RVC_PYTHON")
    if configured_path:
        candidate = Path(configured_path).expanduser().resolve()
        if candidate.is_file():
            return str(candidate)
        raise FileNotFoundError(f"RVC_PYTHON non esiste: {candidate}")

    venv_python = RVC_ROOT / ".venv" / "Scripts" / "python.exe"
    if venv_python.is_file():
        return str(venv_python)
    return sys.executable


def generate_sapi_wav(text, output_path):
    if sys.platform != "win32":
        raise RuntimeError("La sintesi vocale SAPI 5 richiede Windows.")

    script = r"""
$ErrorActionPreference = "Stop"
$synth = $null
try {
    [void][System.Reflection.Assembly]::LoadWithPartialName("System.Speech")
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $voice = $synth.GetInstalledVoices() |
        Where-Object { $_.VoiceInfo.Culture.Name -like "it-*" } |
        Select-Object -First 1
    if ($voice) {
        $synth.SelectVoice($voice.VoiceInfo.Name)
        Write-Output ("Voce utilizzata: " + $voice.VoiceInfo.Name)
    } else {
        Write-Output "Nessuna voce SAPI italiana trovata; uso la voce predefinita di Windows."
    }
    $synth.SetOutputToWaveFile($env:MIKU_TTS_OUTPUT)
    $synth.Speak($env:MIKU_TTS_TEXT)
} finally {
    if ($synth) { $synth.Dispose() }
}
"""
    environment = os.environ.copy()
    environment["MIKU_TTS_OUTPUT"] = str(output_path)
    environment["MIKU_TTS_TEXT"] = text
    encoded_script = base64.b64encode(script.encode("utf-16le")).decode("ascii")
    subprocess.run(
        [
            "powershell.exe",
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-EncodedCommand",
            encoded_script,
        ],
        check=True,
        env=environment,
    )
    if not output_path.is_file() or output_path.stat().st_size < 44:
        raise RuntimeError("SAPI 5 non ha prodotto un file WAV valido.")


def validate_wav(path):
    with wave.open(str(path), "rb") as audio:
        if audio.getnframes() == 0:
            raise RuntimeError(f"Il WAV non contiene audio: {path}")


def main():
    parser = argparse.ArgumentParser(
        description="Genera un WAV con la voce RVC di Miku usata da TheyCallMeMiku."
    )
    parser.add_argument(
        "text",
        nargs="?",
        help="Testo da pronunciare. Se omesso, viene richiesto nel terminale.",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="File WAV di destinazione (predefinito: generated-audio/<id>-miku.wav).",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Consente di sovrascrivere il file di destinazione.",
    )
    args = parser.parse_args()

    if sys.platform != "win32":
        parser.error("Questo script richiede Windows e SAPI 5.")

    text = args.text if args.text is not None else input("Testo da far pronunciare a Miku: ")
    text = text.strip()
    if not text:
        parser.error("Il testo non può essere vuoto.")
    if len(text) > 1000:
        parser.error("Il testo non può superare 1000 caratteri, come nell'app.")

    if not RVC_MODEL.is_file():
        raise FileNotFoundError(f"Modello RVC di Miku non trovato: {RVC_MODEL}")
    cli_module = RVC_ROOT / "infer" / "cli.py"
    if not cli_module.is_file():
        raise FileNotFoundError(f"CLI RVC non trovata: {cli_module}")

    ffmpeg = find_ffmpeg()
    rvc_python = find_rvc_python()
    output_path = (
        args.output.expanduser().resolve()
        if args.output
        else GENERATED_AUDIO / f"{uuid.uuid4()}-miku.wav"
    )
    if output_path.suffix.lower() != ".wav":
        parser.error("Il file di destinazione deve avere estensione .wav.")
    if output_path.exists() and not args.overwrite:
        parser.error(
            f"Il file esiste già: {output_path}. Usa --overwrite per sovrascriverlo."
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    GENERATED_AUDIO.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(
        prefix=".miku-tts-", dir=GENERATED_AUDIO
    ) as temporary_directory:
        temporary_path = Path(temporary_directory)
        source_wav = temporary_path / "input.wav"
        normalized_wav = temporary_path / "normalized.wav"
        converted_wav = temporary_path / "miku.wav"

        print(f"[TTS] Creo la voce SAPI ({len(text)} caratteri).")
        generate_sapi_wav(text, source_wav)

        print("[FFmpeg] Normalizzo l'audio a mono, 44100 Hz, PCM 16-bit.")
        subprocess.run(
            [
                ffmpeg,
                "-y",
                "-i",
                str(source_wav),
                "-ac",
                "1",
                "-ar",
                "44100",
                "-c:a",
                "pcm_s16le",
                str(normalized_wav),
            ],
            check=True,
        )
        validate_wav(normalized_wav)

        environment = os.environ.copy()
        environment["PYTHONUTF8"] = "1"
        environment["PYTHONIOENCODING"] = "utf-8"
        ffmpeg_directory = str(Path(ffmpeg).resolve().parent)
        path_key = next(
            (key for key in environment if key.lower() == "path"), "PATH"
        )
        environment[path_key] = os.pathsep.join(
            part for part in (ffmpeg_directory, environment.get(path_key, "")) if part
        )

        print("[RVC] Converto l'audio con il modello di Miku.")
        subprocess.run(
            [
                rvc_python,
                "-m",
                "infer.cli",
                "--model",
                str(RVC_MODEL),
                "--input",
                str(normalized_wav),
                "--output",
                str(converted_wav),
                "--pitch",
                "12",
                "--f0-method",
                "rmvpe",
                "--index-rate",
                "0",
                "--overwrite",
            ],
            cwd=RVC_ROOT,
            env=environment,
            check=True,
        )

        validate_wav(converted_wav)
        subprocess.run(
            [
                ffmpeg,
                "-v",
                "error",
                "-i",
                str(converted_wav),
                "-f",
                "null",
                "NUL",
            ],
            check=True,
        )
        shutil.copy2(converted_wav, output_path)

    print(f"[OK] WAV salvato in: {output_path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (
        FileNotFoundError,
        OSError,
        RuntimeError,
        subprocess.CalledProcessError,
        wave.Error,
    ) as error:
        print(f"Errore: {error}", file=sys.stderr)
        raise SystemExit(1)
