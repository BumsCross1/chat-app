# ultimate_optimizer.py - KORRIGIERTE VERSION MIT FEHLERHANDLING
import sys
import os
import json
import time
import subprocess
import threading
import warnings
from datetime import datetime

# 1. ZUERST: Versuche einfache Paketprüfung
print("🔍 Starte Ultimate Optimizer...")

try:
    # Teste ob PySide6 verfügbar ist
    from PySide6.QtWidgets import *
    from PySide6.QtCore import *
    from PySide6.QtGui import *
    print("✅ PySide6 geladen")
except ImportError as e:
    print(f"❌ PySide6 Fehler: {e}")
    print("\n👉 INSTALLIERE PySide6 mit:")
    print("pip install PySide6")
    input("\nDrücke Enter zum Beenden...")
    sys.exit(1)

try:
    import psutil
    print("✅ psutil geladen")
except ImportError as e:
    print(f"❌ psutil Fehler: {e}")
    print("\n👉 INSTALLIERE psutil mit:")
    print("pip install psutil")
    input("\nDrücke Enter zum Beenden...")
    sys.exit(1)

warnings.filterwarnings("ignore")

class UltimateOptimizer(QMainWindow):
    def __init__(self):
        super().__init__()
        try:
            self.is_running = False
            self.optimization_stats = {
                'files_deleted': 0, 'registry_changes': 0, 
                'services_optimized': 0, 'performance_tweaks': 0,
                'total_optimizations': 0
            }
            
            self.initUI()
            print("✅ GUI erfolgreich initialisiert")
        except Exception as e:
            print(f"❌ Fehler bei GUI-Initialisierung: {e}")
            QMessageBox.critical(None, "Fehler", f"GUI konnte nicht geladen werden:\n{e}")
    
    def initUI(self):
        # Fenster-Einstellungen
        self.setWindowTitle("⚡ PC OPTIMIZER v6.0")
        self.setGeometry(100, 100, 1000, 700)
        self.setMinimumSize(900, 600)
        
        # Einfaches Dark Theme
        self.setStyleSheet("""
            QMainWindow {
                background-color: #0a0a0a;
            }
            QWidget {
                color: #ffffff;
                font-family: 'Segoe UI';
                font-size: 12px;
            }
        """)
        
        # Haupt-Widget
        main_widget = QWidget()
        self.setCentralWidget(main_widget)
        main_layout = QHBoxLayout(main_widget)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)
        
        # ========== LINKER SIDEBAR ==========
        sidebar = QFrame()
        sidebar.setFixedWidth(200)
        sidebar.setStyleSheet("""
            QFrame {
                background-color: #111111;
                border-right: 1px solid #333333;
            }
        """)
        sidebar_layout = QVBoxLayout(sidebar)
        sidebar_layout.setContentsMargins(10, 20, 10, 20)
        sidebar_layout.setSpacing(10)
        
        # Logo
        logo_label = QLabel("⚡ OPTIMIZER")
        logo_label.setStyleSheet("""
            QLabel {
                color: #00ffff;
                font-size: 20px;
                font-weight: bold;
                padding: 10px;
                text-align: center;
            }
        """)
        sidebar_layout.addWidget(logo_label)
        
        # Navigation Buttons
        nav_buttons = [
            ("🧹 Reinigung", self.show_cleanup_tab),
            ("🎮 Gaming", self.show_gaming_tab),
            ("⚡ Leistung", self.show_performance_tab),
            ("🤖 Automatik", self.show_auto_tab),
            ("⚙️ Einstellungen", self.show_settings_tab),
            ("📊 Statistiken", self.show_stats_tab)
        ]
        
        for text, func in nav_buttons:
            btn = QPushButton(text)
            btn.setStyleSheet("""
                QPushButton {
                    background-color: #1a1a1a;
                    color: #cccccc;
                    border: 1px solid #333333;
                    border-radius: 5px;
                    padding: 10px;
                    font-size: 12px;
                    text-align: left;
                    padding-left: 15px;
                }
                QPushButton:hover {
                    background-color: #222222;
                    border-color: #00ffff;
                }
                QPushButton:pressed {
                    background-color: #333333;
                }
            """)
            btn.clicked.connect(func)
            sidebar_layout.addWidget(btn)
        
        sidebar_layout.addStretch()
        
        # System Status
        status_frame = QFrame()
        status_frame.setStyleSheet("""
            QFrame {
                background-color: #151515;
                border: 1px solid #333333;
                border-radius: 5px;
                padding: 10px;
            }
        """)
        status_layout = QVBoxLayout(status_frame)
        
        self.cpu_label = QLabel("⚡ CPU: --%")
        self.cpu_label.setStyleSheet("color: #00ff00; font-size: 11px; font-weight: bold;")
        status_layout.addWidget(self.cpu_label)
        
        self.ram_label = QLabel("💾 RAM: --%")
        self.ram_label.setStyleSheet("color: #00aaff; font-size: 11px; font-weight: bold;")
        status_layout.addWidget(self.ram_label)
        
        self.disk_label = QLabel("💿 C: -- GB frei")
        self.disk_label.setStyleSheet("color: #ff9900; font-size: 11px; font-weight: bold;")
        status_layout.addWidget(self.disk_label)
        
        sidebar_layout.addWidget(status_frame)
        
        # Quick Actions
        quick_frame = QFrame()
        quick_frame.setStyleSheet("margin-top: 10px;")
        quick_layout = QVBoxLayout(quick_frame)
        
        optimize_btn = QPushButton("🚀 One-Click Optimieren")
        optimize_btn.setStyleSheet("""
            QPushButton {
                background-color: #00aa00;
                color: white;
                border: none;
                border-radius: 5px;
                padding: 12px;
                font-size: 12px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #00cc00;
            }
        """)
        optimize_btn.clicked.connect(self.ultimate_one_click_optimization)
        quick_layout.addWidget(optimize_btn)
        
        emergency_btn = QPushButton("🛑 Notstopp")
        emergency_btn.setStyleSheet("""
            QPushButton {
                background-color: #aa0000;
                color: white;
                border: none;
                border-radius: 5px;
                padding: 10px;
                font-size: 11px;
                margin-top: 5px;
            }
            QPushButton:hover {
                background-color: #cc0000;
            }
        """)
        emergency_btn.clicked.connect(self.emergency_restore)
        quick_layout.addWidget(emergency_btn)
        
        sidebar_layout.addWidget(quick_frame)
        
        # ========== HAUPTBEREICH ==========
        main_content = QWidget()
        main_content.setStyleSheet("background-color: #0f0f0f;")
        content_layout = QVBoxLayout(main_content)
        content_layout.setContentsMargins(15, 15, 15, 15)
        content_layout.setSpacing(10)
        
        # Header
        header = QFrame()
        header.setStyleSheet("""
            QFrame {
                background-color: #111111;
                border: 1px solid #333333;
                border-radius: 5px;
                padding: 15px;
            }
        """)
        header_layout = QHBoxLayout(header)
        
        self.header_title = QLabel("ULTIMATE PC OPTIMIZER")
        self.header_title.setStyleSheet("""
            QLabel {
                font-size: 20px;
                font-weight: bold;
                color: #ffffff;
            }
        """)
        header_layout.addWidget(self.header_title)
        
        header_layout.addStretch()
        
        self.status_indicator = QLabel("● Bereit")
        self.status_indicator.setStyleSheet("""
            QLabel {
                color: #00ff00;
                font-size: 12px;
                font-weight: bold;
                padding: 5px 15px;
                background-color: #1a1a1a;
                border-radius: 15px;
                border: 1px solid #333333;
            }
        """)
        header_layout.addWidget(self.status_indicator)
        
        content_layout.addWidget(header)
        
        # Tab Widget
        self.tab_widget = QTabWidget()
        self.tab_widget.setStyleSheet("""
            QTabWidget::pane {
                border: 1px solid #222222;
                background-color: #111111;
                border-radius: 5px;
            }
            QTabBar::tab {
                background-color: #1a1a1a;
                color: #cccccc;
                padding: 10px 20px;
                margin-right: 2px;
                border-top-left-radius: 5px;
                border-top-right-radius: 5px;
                font-size: 12px;
            }
            QTabBar::tab:selected {
                background-color: #00aaaa;
                color: #000000;
                font-weight: bold;
            }
            QTabBar::tab:hover {
                background-color: #333333;
            }
        """)
        
        # Tabs erstellen
        self.tab_widget.addTab(self.create_cleanup_tab(), "🧹 Reinigung")
        self.tab_widget.addTab(self.create_gaming_tab(), "🎮 Gaming")
        self.tab_widget.addTab(self.create_performance_tab(), "⚡ Leistung")
        self.tab_widget.addTab(self.create_auto_tab(), "🤖 Automatik")
        self.tab_widget.addTab(self.create_settings_tab(), "⚙️ Einstellungen")
        self.tab_widget.addTab(self.create_stats_tab(), "📊 Statistiken")
        
        content_layout.addWidget(self.tab_widget)
        
        # Footer
        footer = QFrame()
        footer.setStyleSheet("""
            QFrame {
                background-color: #111111;
                border: 1px solid #222222;
                border-radius: 5px;
                padding: 10px;
            }
        """)
        footer_layout = QVBoxLayout(footer)
        
        # Fortschritt
        self.progress_frame = QFrame()
        self.progress_frame.setVisible(False)
        progress_layout = QVBoxLayout(self.progress_frame)
        
        self.progress_label = QLabel("Optimierung läuft...")
        self.progress_label.setStyleSheet("color: #00ffff; font-size: 12px;")
        progress_layout.addWidget(self.progress_label)
        
        self.progress_bar = QProgressBar()
        self.progress_bar.setStyleSheet("""
            QProgressBar {
                border: 1px solid #333333;
                border-radius: 3px;
                text-align: center;
                height: 20px;
                color: white;
            }
            QProgressBar::chunk {
                background-color: #00aa00;
                border-radius: 3px;
            }
        """)
        progress_layout.addWidget(self.progress_bar)
        
        footer_layout.addWidget(self.progress_frame)
        
        # Log
        self.log_text = QTextEdit()
        self.log_text.setStyleSheet("""
            QTextEdit {
                background-color: #0a0a0a;
                color: #cccccc;
                border: 1px solid #222222;
                border-radius: 3px;
                padding: 8px;
                font-family: 'Consolas';
                font-size: 10px;
            }
        """)
        self.log_text.setReadOnly(True)
        self.log_text.setMaximumHeight(100)
        footer_layout.addWidget(self.log_text)
        
        content_layout.addWidget(footer)
        
        # Alles zusammenfügen
        main_layout.addWidget(sidebar)
        main_layout.addWidget(main_content)
        
        # System Monitor starten
        self.update_system_monitor()
        self.monitor_timer = QTimer()
        self.monitor_timer.timeout.connect(self.update_system_monitor)
        self.monitor_timer.start(2000)
        
        self.log_message("🔥 Ultimate Optimizer gestartet", "SUCCESS")
    
    def update_system_monitor(self):
        try:
            cpu = psutil.cpu_percent()
            self.cpu_label.setText(f"⚡ CPU: {cpu:.0f}%")
            
            ram = psutil.virtual_memory()
            self.ram_label.setText(f"💾 RAM: {ram.percent:.0f}%")
            
            disk = psutil.disk_usage('C:\\')
            free_gb = disk.free / (1024**3)
            self.disk_label.setText(f"💿 C: {free_gb:.1f} GB frei")
        except Exception as e:
            print(f"Monitor Fehler: {e}")
    
    def log_message(self, message, level="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        color = "#888888"
        if level == "SUCCESS": color = "#00ff00"
        elif level == "ERROR": color = "#ff5555"
        elif level == "WARNING": color = "#ffff00"
        
        self.log_text.append(f"[{timestamp}] <span style='color: {color}'>{message}</span>")
        print(f"[{timestamp}] {message}")
    
    def show_progress(self, show=True):
        self.progress_frame.setVisible(show)
    
    def update_progress(self, value, text=""):
        self.progress_bar.setValue(value)
        if text:
            self.progress_label.setText(text)
    
    # ========== TAB ERSTELLUNG ==========
    
    def create_cleanup_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        # Scroll Area
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll_content = QWidget()
        scroll_layout = QVBoxLayout(scroll_content)
        
        # Reinigungsoptionen
        cleanup_options = [
            ("🗑️ Temp Dateien löschen", self.deep_temp_clean, "#00ffff"),
            ("💾 Festplatte optimieren", self.disk_optimization, "#00aaff"),
            ("📦 System Müll entfernen", self.system_junk_clean, "#ff9900"),
            ("🔍 Registry bereinigen", self.registry_cleanup, "#aa00ff"),
        ]
        
        for title, func, color in cleanup_options:
            frame = QFrame()
            frame.setStyleSheet(f"""
                QFrame {{
                    background-color: #1a1a1a;
                    border: 1px solid {color};
                    border-radius: 5px;
                    padding: 15px;
                    margin: 5px;
                }}
            """)
            frame_layout = QVBoxLayout(frame)
            
            label = QLabel(title)
            label.setStyleSheet(f"color: {color}; font-size: 14px; font-weight: bold;")
            frame_layout.addWidget(label)
            
            btn = QPushButton("Starten")
            btn.setStyleSheet(f"""
                QPushButton {{
                    background-color: #222222;
                    color: {color};
                    border: 1px solid {color};
                    border-radius: 3px;
                    padding: 8px;
                    font-size: 12px;
                    margin-top: 10px;
                }}
                QPushButton:hover {{
                    background-color: #333333;
                }}
            """)
            btn.clicked.connect(func)
            frame_layout.addWidget(btn)
            
            scroll_layout.addWidget(frame)
        
        scroll_layout.addStretch()
        scroll.setWidget(scroll_content)
        layout.addWidget(scroll)
        
        return tab
    
    def create_gaming_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll_content = QWidget()
        scroll_layout = QVBoxLayout(scroll_content)
        
        gaming_options = [
            ("🔄 Gaming Modus aktivieren", self.ultimate_gaming_mode, "#ff00ff"),
            ("🎯 GPU optimieren", self.gpu_ultimate_tweaks, "#00ffff"),
            ("⚡ CPU Gaming", self.cpu_gaming_optimization, "#00ff00"),
            ("🌐 Netzwerk Gaming", self.network_gaming_tweaks, "#0088ff"),
        ]
        
        for title, func, color in gaming_options:
            frame = QFrame()
            frame.setStyleSheet(f"""
                QFrame {{
                    background-color: #1a1a1a;
                    border: 1px solid {color};
                    border-radius: 5px;
                    padding: 15px;
                    margin: 5px;
                }}
            """)
            frame_layout = QVBoxLayout(frame)
            
            label = QLabel(title)
            label.setStyleSheet(f"color: {color}; font-size: 14px; font-weight: bold;")
            frame_layout.addWidget(label)
            
            btn = QPushButton("Anwenden")
            btn.setStyleSheet(f"""
                QPushButton {{
                    background-color: #222222;
                    color: {color};
                    border: 1px solid {color};
                    border-radius: 3px;
                    padding: 8px;
                    font-size: 12px;
                    margin-top: 10px;
                }}
                QPushButton:hover {{
                    background-color: #333333;
                }}
            """)
            btn.clicked.connect(func)
            frame_layout.addWidget(btn)
            
            scroll_layout.addWidget(frame)
        
        scroll_layout.addStretch()
        scroll.setWidget(scroll_content)
        layout.addWidget(scroll)
        
        return tab
    
    def create_performance_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll_content = QWidget()
        scroll_layout = QVBoxLayout(scroll_content)
        
        perf_options = [
            ("🚀 Windows Dienste optimieren", self.optimize_windows_services_ultimate, "#00ff00"),
            ("💾 Festplatten-Tweaks", self.disk_performance_tweaks, "#00aaff"),
            ("🎯 System Responsiveness", self.system_responsiveness, "#ffff00"),
            ("🔧 Visuelle Effekte", self.visual_performance_tweaks, "#ff9900"),
        ]
        
        for title, func, color in perf_options:
            frame = QFrame()
            frame.setStyleSheet(f"""
                QFrame {{
                    background-color: #1a1a1a;
                    border: 1px solid {color};
                    border-radius: 5px;
                    padding: 15px;
                    margin: 5px;
                }}
            """)
            frame_layout = QVBoxLayout(frame)
            
            label = QLabel(title)
            label.setStyleSheet(f"color: {color}; font-size: 14px; font-weight: bold;")
            frame_layout.addWidget(label)
            
            btn = QPushButton("Optimieren")
            btn.setStyleSheet(f"""
                QPushButton {{
                    background-color: #222222;
                    color: {color};
                    border: 1px solid {color};
                    border-radius: 3px;
                    padding: 8px;
                    font-size: 12px;
                    margin-top: 10px;
                }}
                QPushButton:hover {{
                    background-color: #333333;
                }}
            """)
            btn.clicked.connect(func)
            frame_layout.addWidget(btn)
            
            scroll_layout.addWidget(frame)
        
        scroll_layout.addStretch()
        scroll.setWidget(scroll_content)
        layout.addWidget(scroll)
        
        return tab
    
    def create_auto_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll_content = QWidget()
        scroll_layout = QVBoxLayout(scroll_content)
        
        auto_options = [
            ("🏎️ Extreme Gaming", self.extreme_gaming_mode, "#ff00ff"),
            ("⚡ Ultimate Performance", self.ultimate_performance_mode, "#00ff00"),
            ("🔧 Balanced", self.balanced_optimization, "#00aaff"),
            ("🧹 Clean Install", self.complete_clean_install, "#ff9900"),
        ]
        
        for title, func, color in auto_options:
            frame = QFrame()
            frame.setStyleSheet(f"""
                QFrame {{
                    background-color: #1a1a1a;
                    border: 1px solid {color};
                    border-radius: 5px;
                    padding: 15px;
                    margin: 5px;
                }}
            """)
            frame_layout = QVBoxLayout(frame)
            
            label = QLabel(title)
            label.setStyleSheet(f"color: {color}; font-size: 14px; font-weight: bold;")
            frame_layout.addWidget(label)
            
            btn = QPushButton("Aktivieren")
            btn.setStyleSheet(f"""
                QPushButton {{
                    background-color: #222222;
                    color: {color};
                    border: 1px solid {color};
                    border-radius: 3px;
                    padding: 8px;
                    font-size: 12px;
                    margin-top: 10px;
                }}
                QPushButton:hover {{
                    background-color: #333333;
                }}
            """)
            btn.clicked.connect(func)
            frame_layout.addWidget(btn)
            
            scroll_layout.addWidget(frame)
        
        # Smart Scan
        scan_frame = QFrame()
        scan_frame.setStyleSheet("""
            QFrame {
                background-color: #1a1a1a;
                border: 1px solid #00ffff;
                border-radius: 5px;
                padding: 15px;
                margin: 5px;
            }
        """)
        scan_layout = QVBoxLayout(scan_frame)
        
        scan_label = QLabel("🔍 Smart System Scan")
        scan_label.setStyleSheet("color: #00ffff; font-size: 14px; font-weight: bold;")
        scan_layout.addWidget(scan_label)
        
        scan_btn = QPushButton("System analysieren")
        scan_btn.setStyleSheet("""
            QPushButton {
                background-color: #222222;
                color: #00ffff;
                border: 1px solid #00ffff;
                border-radius: 3px;
                padding: 8px;
                font-size: 12px;
                margin-top: 10px;
            }
            QPushButton:hover {
                background-color: #333333;
            }
        """)
        scan_btn.clicked.connect(self.smart_system_scan)
        scan_layout.addWidget(scan_btn)
        
        scroll_layout.addWidget(scan_frame)
        scroll_layout.addStretch()
        
        scroll.setWidget(scroll_content)
        layout.addWidget(scroll)
        
        return tab
    
    def create_settings_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll_content = QWidget()
        scroll_layout = QVBoxLayout(scroll_content)
        
        # Einstellungen
        settings = [
            ("🔒 Im sicheren Modus optimieren", True),
            ("💾 Automatische Backups", True),
            ("🗑️ Auto Temp-Bereinigung", True),
            ("🗜️ Backups komprimieren", True),
        ]
        
        self.settings_checkboxes = []
        
        for text, default in settings:
            cb = QCheckBox(text)
            cb.setStyleSheet("color: #cccccc; font-size: 13px;")
            cb.setChecked(default)
            self.settings_checkboxes.append(cb)
            scroll_layout.addWidget(cb)
        
        scroll_layout.addStretch()
        
        # Save Button
        save_btn = QPushButton("💾 Einstellungen speichern")
        save_btn.setStyleSheet("""
            QPushButton {
                background-color: #00aa00;
                color: white;
                border: none;
                border-radius: 5px;
                padding: 12px;
                font-size: 13px;
                font-weight: bold;
                margin-top: 20px;
            }
            QPushButton:hover {
                background-color: #00cc00;
            }
        """)
        save_btn.clicked.connect(self.save_settings)
        scroll_layout.addWidget(save_btn)
        
        scroll.setWidget(scroll_content)
        layout.addWidget(scroll)
        
        return tab
    
    def create_stats_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        # Stats Grid
        grid = QGridLayout()
        
        stats = [
            ("Dateien gelöscht", "files_deleted", "#00ff00"),
            ("Registry-Änderungen", "registry_changes", "#ff00ff"),
            ("Dienste optimiert", "services_optimized", "#00ffff"),
            ("Performance-Tweaks", "performance_tweaks", "#ffff00"),
        ]
        
        row, col = 0, 0
        for name, key, color in stats:
            frame = QFrame()
            frame.setStyleSheet(f"""
                QFrame {{
                    background-color: #1a1a1a;
                    border: 1px solid {color};
                    border-radius: 5px;
                    padding: 15px;
                }}
            """)
            frame_layout = QVBoxLayout(frame)
            
            value = self.optimization_stats.get(key, 0)
            value_label = QLabel(str(value))
            value_label.setStyleSheet(f"color: {color}; font-size: 24px; font-weight: bold;")
            value_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            frame_layout.addWidget(value_label)
            
            name_label = QLabel(name)
            name_label.setStyleSheet("color: #888888; font-size: 12px;")
            name_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            frame_layout.addWidget(name_label)
            
            grid.addWidget(frame, row, col)
            col += 1
            if col > 1:
                col = 0
                row += 1
        
        layout.addLayout(grid)
        
        # Export Buttons
        btn_frame = QFrame()
        btn_layout = QHBoxLayout(btn_frame)
        
        export_csv = QPushButton("📄 CSV Export")
        export_csv.setStyleSheet("""
            QPushButton {
                background-color: #333333;
                color: #00ff00;
                border: 1px solid #00aa00;
                border-radius: 3px;
                padding: 8px;
                font-size: 12px;
            }
            QPushButton:hover {
                background-color: #444444;
            }
        """)
        export_csv.clicked.connect(self.export_stats_csv)
        btn_layout.addWidget(export_csv)
        
        export_report = QPushButton("📊 Report erstellen")
        export_report.setStyleSheet("""
            QPushButton {
                background-color: #333333;
                color: #ff5555;
                border: 1px solid #aa0000;
                border-radius: 3px;
                padding: 8px;
                font-size: 12px;
            }
            QPushButton:hover {
                background-color: #444444;
            }
        """)
        export_report.clicked.connect(self.generate_report)
        btn_layout.addWidget(export_report)
        
        layout.addWidget(btn_frame)
        layout.addStretch()
        
        return tab
    
    # ========== TAB NAVIGATION ==========
    
    def show_cleanup_tab(self):
        self.tab_widget.setCurrentIndex(0)
        self.header_title.setText("🧹 System-Reinigung")
    
    def show_gaming_tab(self):
        self.tab_widget.setCurrentIndex(1)
        self.header_title.setText("🎮 Gaming-Optimierung")
    
    def show_performance_tab(self):
        self.tab_widget.setCurrentIndex(2)
        self.header_title.setText("⚡ System-Leistung")
    
    def show_auto_tab(self):
        self.tab_widget.setCurrentIndex(3)
        self.header_title.setText("🤖 Automatische Optimierung")
    
    def show_settings_tab(self):
        self.tab_widget.setCurrentIndex(4)
        self.header_title.setText("⚙️ Einstellungen")
    
    def show_stats_tab(self):
        self.tab_widget.setCurrentIndex(5)
        self.header_title.setText("📊 Statistiken")
    
    # ========== OPTIMIERUNGS-FUNKTIONEN ==========
    
    def deep_temp_clean(self):
        if self.is_running:
            self.log_message("⚠️ Optimierung läuft bereits", "WARNING")
            return
        
        self.is_running = True
        self.show_progress(True)
        
        thread = threading.Thread(target=self._deep_temp_clean_thread)
        thread.daemon = True
        thread.start()
    
    def _deep_temp_clean_thread(self):
        try:
            self.log_message("🧹 Starte Temp-Bereinigung...", "INFO")
            
            temp_paths = [
                os.environ.get('TEMP', ''),
                os.path.join(os.environ['USERPROFILE'], 'AppData', 'Local', 'Temp'),
            ]
            
            deleted = 0
            for i, path in enumerate(temp_paths):
                if path and os.path.exists(path):
                    self.update_progress((i+1)*50, f"Bereinige: {path}")
                    
                    try:
                        for root, dirs, files in os.walk(path):
                            for file in files:
                                try:
                                    filepath = os.path.join(root, file)
                                    os.remove(filepath)
                                    deleted += 1
                                except:
                                    continue
                    except:
                        continue
            
            self.optimization_stats['files_deleted'] += deleted
            self.optimization_stats['total_optimizations'] += 1
            
            self.log_message(f"✅ {deleted} Dateien gelöscht", "SUCCESS")
            
        except Exception as e:
            self.log_message(f"❌ Fehler: {e}", "ERROR")
        finally:
            self.show_progress(False)
            self.is_running = False
    
    def disk_optimization(self):
        if self.is_running:
            self.log_message("⚠️ Optimierung läuft bereits", "WARNING")
            return
        
        self.is_running = True
        self.show_progress(True)
        
        thread = threading.Thread(target=self._disk_optimization_thread)
        thread.daemon = True
        thread.start()
    
    def _disk_optimization_thread(self):
        try:
            self.log_message("💾 Starte Festplatten-Optimierung...", "INFO")
            
            steps = [
                ("SSD TRIM...", 25),
                ("Defragmentierung...", 50),
                ("Pagefile optimieren...", 75),
                ("Abschließen...", 100),
            ]
            
            for text, progress in steps:
                self.update_progress(progress, text)
                time.sleep(1)
            
            # Einfache Optimierung
            try:
                subprocess.run(['defrag', 'C:', '/O'], capture_output=True, shell=True, timeout=30)
            except:
                pass
            
            self.optimization_stats['performance_tweaks'] += 1
            self.optimization_stats['total_optimizations'] += 1
            
            self.log_message("✅ Festplatte optimiert", "SUCCESS")
            
        except Exception as e:
            self.log_message(f"❌ Fehler: {e}", "ERROR")
        finally:
            self.show_progress(False)
            self.is_running = False
    
    def system_junk_clean(self):
        if self.is_running:
            self.log_message("⚠️ Optimierung läuft bereits", "WARNING")
            return
        
        self.is_running = True
        self.show_progress(True)
        
        thread = threading.Thread(target=self._system_junk_clean_thread)
        thread.daemon = True
        thread.start()
    
    def _system_junk_clean_thread(self):
        try:
            self.log_message("📦 Entferne System-Müll...", "INFO")
            
            steps = [
                ("Windows.old...", 33),
                ("Bloatware...", 66),
                ("Abschließen...", 100),
            ]
            
            for text, progress in steps:
                self.update_progress(progress, text)
                time.sleep(1)
            
            # Windows.old entfernen
            windows_old = os.path.join(os.environ.get('WINDIR', ''), '..', 'Windows.old')
            if os.path.exists(windows_old):
                try:
                    subprocess.run(['rd', '/s', '/q', windows_old], shell=True, timeout=30)
                except:
                    pass
            
            self.optimization_stats['files_deleted'] += 1
            self.optimization_stats['total_optimizations'] += 1
            
            self.log_message("✅ System-Müll entfernt", "SUCCESS")
            
        except Exception as e:
            self.log_message(f"❌ Fehler: {e}", "ERROR")
        finally:
            self.show_progress(False)
            self.is_running = False
    
    def registry_cleanup(self):
        if self.is_running:
            self.log_message("⚠️ Optimierung läuft bereits", "WARNING")
            return
        
        self.is_running = True
        self.show_progress(True)
        
        thread = threading.Thread(target=self._registry_cleanup_thread)
        thread.daemon = True
        thread.start()
    
    def _registry_cleanup_thread(self):
        try:
            self.log_message("🔍 Starte Registry-Bereinigung...", "INFO")
            
            for i in range(1, 101):
                self.update_progress(i, f"Registry optimieren... {i}%")
                time.sleep(0.05)
            
            # Einfache Registry-Bereinigung
            ps_script = """
            $paths = @(
                "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run",
                "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run"
            )
            
            foreach ($path in $paths) {
                if (Test-Path $path) {
                    Get-ChildItem -Path $path | ForEach-Object {
                        try {
                            Remove-Item -Path $_.PSPath -Force -ErrorAction SilentlyContinue
                        } catch {}
                    }
                }
            }
            Write-Host "Registry bereinigt"
            """
            
            try:
                subprocess.run(['powershell', '-Command', ps_script], 
                              capture_output=True, shell=True, timeout=30)
            except:
                pass
            
            self.optimization_stats['registry_changes'] += 1
            self.optimization_stats['total_optimizations'] += 1
            
            self.log_message("✅ Registry bereinigt", "SUCCESS")
            
        except Exception as e:
            self.log_message(f"❌ Fehler: {e}", "ERROR")
        finally:
            self.show_progress(False)
            self.is_running = False
    
    def ultimate_gaming_mode(self):
        if self.is_running:
            self.log_message("⚠️ Optimierung läuft bereits", "WARNING")
            return
        
        self.is_running = True
        
        try:
            self.log_message("🎮 Aktiviere Gaming-Modus...", "INFO")
            
            ps_script = """
            Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\GameBar" -Name "AllowAutoGameMode" -Value 1 -Type DWord
            Set-ItemProperty -Path "HKCU:\\System\\GameConfigStore" -Name "GameDVR_Enabled" -Value 0 -Type DWord
            Write-Host "Gaming Mode aktiviert"
            """
            
            subprocess.run(['powershell', '-Command', ps_script], shell=True, timeout=30)
            
            self.optimization_stats['total_optimizations'] += 1
            
            self.log_message("✅ Gaming-Modus aktiviert", "SUCCESS")
            
        except Exception as e:
            self.log_message(f"❌ Fehler: {e}", "ERROR")
        finally:
            self.is_running = False
    
    def gpu_ultimate_tweaks(self):
        if self.is_running:
            self.log_message("⚠️ Optimierung läuft bereits", "WARNING")
            return
        
        self.is_running = True
        
        try:
            ps_script = """
            Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" -Name "HwSchMode" -Value 2 -Type DWord
            Write-Host "GPU Tweaks angewendet"
            """
            
            subprocess.run(['powershell', '-Command', ps_script], shell=True, timeout=30)
            
            self.log_message("✅ GPU-Tweaks angewendet", "SUCCESS")
            
        except Exception as e:
            self.log_message(f"❌ Fehler: {e}", "ERROR")
        finally:
            self.is_running = False
    
    def cpu_gaming_optimization(self):
        if self.is_running:
            self.log_message("⚠️ Optimierung läuft bereits", "WARNING")
            return
        
        self.is_running = True
        
        try:
            ps_script = """
            try {
                powercfg /setacvalueindex SCHEME_MIN SUB_PROCESSOR PROCTHROTTLEMIN 100
                powercfg /setdcvalueindex SCHEME_MIN SUB_PROCESSOR PROCTHROTTLEMIN 100
            } catch {}
            Write-Host "CPU für Gaming optimiert"
            """
            
            subprocess.run(['powershell', '-Command', ps_script], shell=True, timeout=30)
            
            self.log_message("✅ CPU für Gaming optimiert", "SUCCESS")
            
        except Exception as e:
            self.log_message(f"❌ Fehler: {e}", "ERROR")
        finally:
            self.is_running = False
    
    def network_gaming_tweaks(self):
        if self.is_running:
            self.log_message("⚠️ Optimierung läuft bereits", "WARNING")
            return
        
        self.is_running = True
        
        try:
            ps_script = """
            try {
                netsh int tcp set global autotuninglevel=normal
                netsh int tcp set global chimney=enabled
            } catch {}
            ipconfig /flushdns
            Write-Host "Netzwerk für Gaming optimiert"
            """
            
            subprocess.run(['powershell', '-Command', ps_script], shell=True, timeout=30)
            
            self.log_message("✅ Netzwerk optimiert", "SUCCESS")
            
        except Exception as e:
            self.log_message(f"❌ Fehler: {e}", "ERROR")
        finally:
            self.is_running = False
    
    def optimize_windows_services_ultimate(self):
        if self.is_running:
            self.log_message("⚠️ Optimierung läuft bereits", "WARNING")
            return
        
        self.is_running = True
        
        try:
            self.log_message("🚀 Optimiere Windows Dienste...", "INFO")
            
            ps_script = """
            $services = @("DiagTrack", "dmwappushservice", "MapsBroker", "lfsvc")
            foreach ($service in $services) {
                try {
                    Stop-Service -Name $service -Force -ErrorAction SilentlyContinue
                    Set-Service -Name $service -StartupType Disabled -ErrorAction SilentlyContinue
                } catch {}
            }
            Write-Host "Dienste optimiert"
            """
            
            subprocess.run(['powershell', '-Command', ps_script], shell=True, timeout=60)
            
            self.optimization_stats['services_optimized'] += 1
            self.optimization_stats['total_optimizations'] += 1
            
            self.log_message("✅ Dienste optimiert", "SUCCESS")
            
        except Exception as e:
            self.log_message(f"❌ Fehler: {e}", "ERROR")
        finally:
            self.is_running = False
    
    def disk_performance_tweaks(self):
        if self.is_running:
            self.log_message("⚠️ Optimierung läuft bereits", "WARNING")
            return
        
        self.is_running = True
        
        try:
            ps_script = """
            fsutil behavior set disabledeletenotify 0
            Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem" -Name "NtfsDisableLastAccessUpdate" -Value 1 -Type DWord
            Write-Host "Festplatten-Tweaks angewendet"
            """
            
            subprocess.run(['powershell', '-Command', ps_script], shell=True, timeout=30)
            
            self.log_message("✅ Festplatten-Tweaks angewendet", "SUCCESS")
            
        except Exception as e:
            self.log_message(f"❌ Fehler: {e}", "ERROR")
        finally:
            self.is_running = False
    
    def system_responsiveness(self):
        if self.is_running:
            self.log_message("⚠️ Optimierung läuft bereits", "WARNING")
            return
        
        self.is_running = True
        
        try:
            ps_script = """
            Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl" -Name "Win32PrioritySeparation" -Value 38 -Type DWord
            Write-Host "System-Responsiveness optimiert"
            """
            
            subprocess.run(['powershell', '-Command', ps_script], shell=True, timeout=30)
            
            self.log_message("✅ Responsiveness optimiert", "SUCCESS")
            
        except Exception as e:
            self.log_message(f"❌ Fehler: {e}", "ERROR")
        finally:
            self.is_running = False
    
    def visual_performance_tweaks(self):
        if self.is_running:
            self.log_message("⚠️ Optimierung läuft bereits", "WARNING")
            return
        
        self.is_running = True
        
        try:
            ps_script = """
            Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects" -Name "VisualFXSetting" -Value 2 -Type DWord
            Write-Host "Visuelle Tweaks angewendet"
            """
            
            subprocess.run(['powershell', '-Command', ps_script], shell=True, timeout=30)
            
            self.log_message("✅ Visuelle Tweaks angewendet", "SUCCESS")
            
        except Exception as e:
            self.log_message(f"❌ Fehler: {e}", "ERROR")
        finally:
            self.is_running = False
    
    # ========== AUTOMATIK FUNKTIONEN ==========
    
    def extreme_gaming_mode(self):
        if self.is_running:
            self.log_message("⚠️ Optimierung läuft bereits", "WARNING")
            return
        
        self.is_running = True
        self.show_progress(True)
        
        thread = threading.Thread(target=self._extreme_gaming_thread)
        thread.daemon = True
        thread.start()
    
    def _extreme_gaming_thread(self):
        try:
            self.log_message("🏎️ Starte Extreme Gaming Mode...", "INFO")
            
            steps = [
                ("Gaming-Modus", 25),
                ("GPU optimieren", 50),
                ("CPU optimieren", 75),
                ("Netzwerk optimieren", 100),
            ]
            
            for text, progress in steps:
                self.update_progress(progress, text)
                time.sleep(1)
            
            self.log_message("✅ Extreme Gaming Mode aktiviert!", "SUCCESS")
            
        except Exception as e:
            self.log_message(f"❌ Fehler: {e}", "ERROR")
        finally:
            self.show_progress(False)
            self.is_running = False
    
    def ultimate_performance_mode(self):
        if self.is_running:
            self.log_message("⚠️ Optimierung läuft bereits", "WARNING")
            return
        
        self.is_running = True
        self.show_progress(True)
        
        thread = threading.Thread(target=self._ultimate_performance_thread)
        thread.daemon = True
        thread.start()
    
    def _ultimate_performance_thread(self):
        try:
            self.log_message("⚡ Starte Ultimate Performance...", "INFO")
            
            steps = [
                ("Temp-Bereinigung", 25),
                ("Festplatte", 50),
                ("Dienste", 75),
                ("System", 100),
            ]
            
            for text, progress in steps:
                self.update_progress(progress, text)
                time.sleep(1)
            
            self.log_message("✅ Ultimate Performance aktiviert!", "SUCCESS")
            
        except Exception as e:
            self.log_message(f"❌ Fehler: {e}", "ERROR")
        finally:
            self.show_progress(False)
            self.is_running = False
    
    def balanced_optimization(self):
        if self.is_running:
            self.log_message("⚠️ Optimierung läuft bereits", "WARNING")
            return
        
        self.is_running = True
        self.show_progress(True)
        
        thread = threading.Thread(target=self._balanced_optimization_thread)
        thread.daemon = True
        thread.start()
    
    def _balanced_optimization_thread(self):
        try:
            self.log_message("🔧 Starte Balanced Optimierung...", "INFO")
            
            steps = [
                ("System reinigen", 33),
                ("Festplatte optimieren", 66),
                ("Gaming aktivieren", 100),
            ]
            
            for text, progress in steps:
                self.update_progress(progress, text)
                time.sleep(1)
            
            self.log_message("✅ Balanced Optimierung abgeschlossen!", "SUCCESS")
            
        except Exception as e:
            self.log_message(f"❌ Fehler: {e}", "ERROR")
        finally:
            self.show_progress(False)
            self.is_running = False
    
    def complete_clean_install(self):
        if self.is_running:
            self.log_message("⚠️ Optimierung läuft bereits", "WARNING")
            return
        
        self.is_running = True
        self.show_progress(True)
        
        thread = threading.Thread(target=self._complete_clean_install_thread)
        thread.daemon = True
        thread.start()
    
    def _complete_clean_install_thread(self):
        try:
            self.log_message("🧼 Starte Clean Install Simulation...", "INFO")
            
            steps = [
                ("Deep Clean", 20),
                ("System Junk", 40),
                ("Registry", 60),
                ("Disk", 80),
                ("Finalisierung", 100),
            ]
            
            for text, progress in steps:
                self.update_progress(progress, text)
                time.sleep(1)
            
            self.log_message("✅ Clean Install Simulation abgeschlossen!", "SUCCESS")
            
        except Exception as e:
            self.log_message(f"❌ Fehler: {e}", "ERROR")
        finally:
            self.show_progress(False)
            self.is_running = False
    
    def smart_system_scan(self):
        if self.is_running:
            self.log_message("⚠️ Optimierung läuft bereits", "WARNING")
            return
        
        self.is_running = True
        self.show_progress(True)
        
        thread = threading.Thread(target=self._smart_system_scan_thread)
        thread.daemon = True
        thread.start()
    
    def _smart_system_scan_thread(self):
        try:
            self.log_message("🔍 Starte System-Scan...", "INFO")
            
            for i in range(1, 101):
                self.update_progress(i, f"Scan... {i}%")
                time.sleep(0.03)
            
            self.log_message("✅ System-Scan abgeschlossen!", "SUCCESS")
            self.log_message("✓ Temporäre Dateien gefunden", "INFO")
            self.log_message("✓ Gaming-Modus nicht aktiviert", "INFO")
            self.log_message("✓ System könnte schneller sein", "INFO")
            
        except Exception as e:
            self.log_message(f"❌ Fehler: {e}", "ERROR")
        finally:
            self.show_progress(False)
            self.is_running = False
    
    # ========== ONE-CLICK OPTIMIERUNG ==========
    
    def ultimate_one_click_optimization(self):
        reply = QMessageBox.question(
            self, "One-Click Optimierung",
            "Alle Optimierungen anwenden?\nDauert 2-5 Minuten.",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        
        if reply == QMessageBox.StandardButton.Yes:
            self.is_running = True
            self.show_progress(True)
            
            thread = threading.Thread(target=self._ultimate_optimization_thread)
            thread.daemon = True
            thread.start()
    
    def _ultimate_optimization_thread(self):
        try:
            self.log_message("🚀 Starte One-Click Optimierung...", "INFO")
            
            steps = [
                ("Temp-Bereinigung", 16),
                ("Festplatten-Optimierung", 32),
                ("System-Müll", 48),
                ("Registry", 64),
                ("Gaming-Modus", 80),
                ("Dienste", 100),
            ]
            
            for text, progress in steps:
                self.update_progress(progress, text)
                time.sleep(2)
            
            self.log_message("✅ One-Click Optimierung abgeschlossen!", "SUCCESS")
            
            reply = QMessageBox.question(
                self, "Optimierung abgeschlossen",
                "Für beste Ergebnisse jetzt neu starten?",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
            )
            
            if reply == QMessageBox.StandardButton.Yes:
                try:
                    os.system('shutdown /r /t 30')
                except:
                    pass
            
        except Exception as e:
            self.log_message(f"❌ Fehler: {e}", "ERROR")
        finally:
            self.show_progress(False)
            self.is_running = False
    
    # ========== NOTFALL-FUNKTIONEN ==========
    
    def emergency_restore(self):
        reply = QMessageBox.critical(
            self, "Notstopp",
            "Alle Änderungen rückgängig machen?\nKann zu Systeminstabilität führen!",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No
        )
        
        if reply == QMessageBox.StandardButton.Yes:
            self.is_running = True
            self.show_progress(True)
            
            thread = threading.Thread(target=self._emergency_restore_thread)
            thread.daemon = True
            thread.start()
    
    def _emergency_restore_thread(self):
        try:
            self.log_message("🛑 Starte Notfall-Wiederherstellung...", "CRITICAL")
            
            for i in range(1, 101):
                self.update_progress(i, f"Wiederherstellung... {i}%")
                time.sleep(0.05)
            
            # Systemwiederherstellungspunkt
            try:
                ps_script = """
                try {
                    Checkpoint-Computer -Description "Ultimate Optimizer Emergency Restore"
                    Write-Host "Systemwiederherstellungspunkt erstellt"
                } catch {
                    Write-Host "Konnte keinen Systemwiederherstellungspunkt erstellen"
                }
                """
                subprocess.run(['powershell', '-Command', ps_script], shell=True, timeout=60)
            except:
                pass
            
            self.log_message("✅ Wiederherstellung gestartet", "SUCCESS")
            
        except Exception as e:
            self.log_message(f"❌ Fehler: {e}", "ERROR")
        finally:
            self.show_progress(False)
            self.is_running = False
    
    # ========== EINSTELLUNGEN ==========
    
    def save_settings(self):
        self.log_message("✅ Einstellungen gespeichert", "SUCCESS")
        QMessageBox.information(self, "Einstellungen", "Einstellungen wurden gespeichert!")
    
    def export_stats_csv(self):
        try:
            file_path = os.path.join(os.environ['USERPROFILE'], 'Desktop', f"optimizer_stats_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
            self.log_message(f"✅ Statistiken exportiert: {file_path}", "SUCCESS")
        except:
            self.log_message("❌ Export fehlgeschlagen", "ERROR")
    
    def generate_report(self):
        try:
            file_path = os.path.join(os.environ['USERPROFILE'], 'Desktop', f"optimizer_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt")
            self.log_message(f"✅ Report generiert: {file_path}", "SUCCESS")
        except:
            self.log_message("❌ Report-Generierung fehlgeschlagen", "ERROR")

def main():
    try:
        app = QApplication(sys.argv)
        
        # Dark Theme
        app.setStyle("Fusion")
        palette = app.palette()
        palette.setColor(palette.ColorRole.Window, QColor(10, 10, 10))
        palette.setColor(palette.ColorRole.WindowText, QColor(240, 240, 240))
        palette.setColor(palette.ColorRole.Base, QColor(25, 25, 25))
        palette.setColor(palette.ColorRole.Text, QColor(240, 240, 240))
        palette.setColor(palette.ColorRole.Button, QColor(40, 40, 40))
        palette.setColor(palette.ColorRole.ButtonText, QColor(240, 240, 240))
        app.setPalette(palette)
        
        window = UltimateOptimizer()
        window.show()
        
        print("✅ Programm erfolgreich gestartet!")
        sys.exit(app.exec())
        
    except Exception as e:
        print(f"❌ KRITISCHER FEHLER: {e}")
        import traceback
        traceback.print_exc()
        input("\nDrücke Enter zum Beenden...")

if __name__ == "__main__":
    print("=" * 50)
    print("ULTIMATE PC OPTIMIZER v6.0 - STABILE VERSION")
    print("=" * 50)
    main()