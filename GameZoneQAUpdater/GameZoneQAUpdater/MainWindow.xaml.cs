using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;

namespace GameZoneQAUpdater
{
    public partial class MainWindow : Window
    {
        // Dropbox direct link (dl=1) for the GameZoneQA Ultimate update ZIP.
        private const string ZipUrl =
            "https://www.dropbox.com/scl/fi/2rvucua5zkyf8blyxhvzh/Gamezone_Update.zip?rlkey=0ui6mk8hgj82lts461jwig13m&st=fp7mskss&dl=1";

        // The Electron app writes the exact portable exe name here before launching
        // the updater. If missing, fall back to the normal brand exe names.
        private const string TargetConfigFileName = "GameZoneQAUpdater.target";
        private const string PreferredTargetExeName = "GameZoneQA Ultimate.exe";

        private string _installDir;
        private string _targetExePath;

        public MainWindow()
        {
            InitializeComponent();

            // .NET 4.7+ defaults to system TLS; pin explicitly to avoid surprises.
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;

            // Self-locate: the install dir is wherever this .exe is running from.
            _installDir = Path.GetDirectoryName(Process.GetCurrentProcess().MainModule.FileName);
            _targetExePath = Path.Combine(_installDir, ResolveTargetExeName(_installDir));

            Loaded += MainWindow_Loaded;
        }

        private void Window_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            try { DragMove(); } catch { }
        }

        private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            try
            {
                await RunUpdate();
            }
            catch (Exception ex)
            {
                MessageBox.Show("Update failed:\n\n" + ex.Message,
                    "GameZoneQA Ultimate Updater", MessageBoxButton.OK, MessageBoxImage.Error);
                TryStartTarget(); // best-effort: relaunch existing exe so the user isn't stranded
                Application.Current.Shutdown();
            }
        }

        private async Task RunUpdate()
        {
            SetStatus("Waiting for GameZoneQA Ultimate to close...", 2);
            await Task.Run(() => WaitForTargetExit(15000));

            SweepOldFiles(_installDir);

            string tempBase = Path.Combine(Path.GetTempPath(),
                "gamezoneqa_ultimate_update_" + DateTime.UtcNow.Ticks);
            Directory.CreateDirectory(tempBase);
            string zipPath = Path.Combine(tempBase, "update.zip");
            string extractPath = Path.Combine(tempBase, "extracted");
            Directory.CreateDirectory(extractPath);

            SetStatus("Connecting...", 5);
            await DownloadAsync(ZipUrl, zipPath);

            SetStatus("Extracting...", 90);
            await Task.Run(() => ZipFile.ExtractToDirectory(zipPath, extractPath));

            SetStatus("Installing...", 95);
            await Task.Run(() => InstallFiles(extractPath, _installDir));

            SetStatus("Restarting...", 100);
            await Task.Delay(350);

            TryStartTarget();
            try { Directory.Delete(tempBase, true); } catch { }
            Application.Current.Shutdown();
        }

        // Poll for the target GameZoneQA Ultimate process and wait for it to exit.
        // Process.GetProcessesByName drops the .exe extension, so
        // "GameZoneQA Ultimate.exe" -> "GameZoneQA Ultimate".
        private void WaitForTargetExit(int timeoutMs)
        {
            string baseName = Path.GetFileNameWithoutExtension(_targetExePath);
            int waited = 0;
            while (waited < timeoutMs)
            {
                Process[] procs = Process.GetProcessesByName(baseName);
                bool anyAlive = false;
                foreach (var p in procs)
                {
                    try { if (!p.HasExited) anyAlive = true; } catch { }
                    p.Dispose();
                }
                if (!anyAlive) break;
                Thread.Sleep(300);
                waited += 300;
            }
            Thread.Sleep(500); // grace period for Windows to release the .exe lock
        }

        private string ResolveTargetExeName(string installDir)
        {
            try
            {
                string targetFile = Path.Combine(installDir, TargetConfigFileName);
                if (File.Exists(targetFile))
                {
                    string configured = Path.GetFileName(File.ReadAllText(targetFile).Trim());
                    if (IsValidTargetExe(configured))
                        return configured;
                }
            }
            catch { }

            try
            {
                if (File.Exists(Path.Combine(installDir, PreferredTargetExeName)))
                    return PreferredTargetExeName;

                foreach (string exe in Directory.GetFiles(installDir, "GameZoneQA Ultimate*.exe"))
                {
                    string name = Path.GetFileName(exe);
                    if (IsValidTargetExe(name))
                        return name;
                }
            }
            catch { }

            return PreferredTargetExeName;
        }

        private bool IsValidTargetExe(string fileName)
        {
            if (string.IsNullOrWhiteSpace(fileName))
                return false;
            if (!fileName.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
                return false;
            if (fileName.Equals("GameZoneQAUpdater.exe", StringComparison.OrdinalIgnoreCase))
                return false;
            if (fileName.Equals("updater.exe", StringComparison.OrdinalIgnoreCase))
                return false;
            if (fileName.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
                return false;
            return fileName.StartsWith("GameZoneQA Ultimate", StringComparison.OrdinalIgnoreCase);
        }

        // Clean any leftover *.old.exe (and *.old.<digits>.exe) so the install
        // folder stays tidy after repeated updates.
        private void SweepOldFiles(string dir)
        {
            try
            {
                foreach (string f in Directory.GetFiles(dir, "*.old.exe"))
                {
                    try { File.Delete(f); } catch { }
                }
                foreach (string f in Directory.GetFiles(dir, "*.old.*.exe"))
                {
                    try { File.Delete(f); } catch { }
                }
            }
            catch { }
        }

        private Task DownloadAsync(string url, string dest)
        {
            var tcs = new TaskCompletionSource<bool>();
            WebClient wc = new WebClient();

            wc.DownloadProgressChanged += (s, e) =>
            {
                double pct = e.TotalBytesToReceive > 0
                    ? (double)e.BytesReceived / e.TotalBytesToReceive * 100.0
                    : 0;
                string mb = (e.BytesReceived / 1024.0 / 1024.0).ToString("0.0");
                string total = e.TotalBytesToReceive > 0
                    ? " / " + (e.TotalBytesToReceive / 1024.0 / 1024.0).ToString("0.0") + " MB"
                    : "";
                Dispatcher.BeginInvoke(new Action(() =>
                {
                    SetStatus("Downloading... " + ((int)pct) + "%", 5 + pct * 0.85);
                    DetailText.Text = mb + " MB" + total;
                }));
            };

            wc.DownloadFileCompleted += (s, e) =>
            {
                wc.Dispose();
                if (e.Cancelled) tcs.TrySetCanceled();
                else if (e.Error != null) tcs.TrySetException(e.Error);
                else tcs.TrySetResult(true);
            };

            wc.DownloadFileAsync(new Uri(url), dest);
            return tcs.Task;
        }

        // Recursively copy extracted contents into the install dir, overwriting.
        // If the zip wraps everything in a single top-level folder (common shape),
        // descend into it so we don't end up with installDir/GameZoneQA/GameZoneQA.exe.
        private void InstallFiles(string sourceDir, string destDir)
        {
            string root = sourceDir;
            string[] topFiles = Directory.GetFiles(root);
            string[] topDirs = Directory.GetDirectories(root);
            if (topFiles.Length == 0 && topDirs.Length == 1)
                root = topDirs[0];

            CopyDirectory(root, destDir);
        }

        private void CopyDirectory(string src, string dst)
        {
            Directory.CreateDirectory(dst);

            foreach (string file in Directory.GetFiles(src))
            {
                string destFile = Path.Combine(dst, Path.GetFileName(file));
                try
                {
                    File.Copy(file, destFile, true);
                }
                catch
                {
                    // File is locked, typically ourselves or GameZoneQA Ultimate.exe
                    // if a stray instance is still alive. Rename
                    // out of the way (Windows allows renaming a locked file) then copy.
                    if (destFile.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
                    {
                        try
                        {
                            string baseName = Path.GetFileNameWithoutExtension(destFile);
                            string oldPath = Path.Combine(dst, baseName + ".old.exe");
                            try { if (File.Exists(oldPath)) File.Delete(oldPath); } catch { }
                            try { File.Move(destFile, oldPath); }
                            catch
                            {
                                string ts = DateTime.UtcNow.Ticks.ToString();
                                File.Move(destFile, Path.Combine(dst, baseName + ".old." + ts + ".exe"));
                            }
                            File.Copy(file, destFile, true);
                        }
                        catch { /* give up silently on this single file */ }
                    }
                }
            }

            foreach (string sub in Directory.GetDirectories(src))
            {
                CopyDirectory(sub, Path.Combine(dst, Path.GetFileName(sub)));
            }
        }

        private void TryStartTarget()
        {
            try
            {
                if (File.Exists(_targetExePath))
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = _targetExePath,
                        WorkingDirectory = _installDir,
                        UseShellExecute = true
                    });
                }
            }
            catch { }
        }

        private void SetStatus(string text, double pct)
        {
            StatusText.Text = text;
            double maxW = ProgressTrack.ActualWidth;
            if (maxW <= 0) maxW = 404;
            double w = Math.Max(0, Math.Min(maxW, maxW * (pct / 100.0)));
            ProgressFill.Width = w;
        }
    }
}
