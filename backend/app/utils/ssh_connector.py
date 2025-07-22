"""
SSH Connector Module - Gerçek ağ cihazlarına bağlanır
backend/app/utils/ssh_connector.py
"""

import paramiko
import asyncio
from typing import Dict, List, Optional, Tuple
import logging
from datetime import datetime
import socket
import time

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SSHConnector:
    """SSH bağlantısı ve komut çalıştırma sınıfı"""
    
    def __init__(self):
        self.client = None
        self.connected = False
        
    async def connect(self, host: str, username: str, password: str, port: int = 22, timeout: int = 10) -> Tuple[bool, str]:
        """
        SSH bağlantısı kurar
        Returns: (success: bool, message: str)
        """
        try:
            self.client = paramiko.SSHClient()
            self.client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            logger.info(f"Connecting to {host}:{port} as {username}")
            
            # Bağlantı kur
            self.client.connect(
                hostname=host,
                port=port,
                username=username,
                password=password,
                timeout=timeout,
                banner_timeout=30,
                auth_timeout=30
            )
            
            self.connected = True
            logger.info(f"Successfully connected to {host}")
            return True, f"Successfully connected to {host}"
            
        except paramiko.AuthenticationException:
            error_msg = f"Authentication failed for {username}@{host}"
            logger.error(error_msg)
            return False, error_msg
            
        except paramiko.SSHException as e:
            error_msg = f"SSH connection error: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
            
        except socket.timeout:
            error_msg = f"Connection timeout to {host}:{port}"
            logger.error(error_msg)
            return False, error_msg
            
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
    
    async def execute_command(self, command: str, timeout: int = 30) -> Tuple[bool, str, str]:
        """
        SSH komut çalıştırır
        Returns: (success: bool, stdout: str, stderr: str)
        """
        if not self.connected or not self.client:
            return False, "", "No SSH connection established"
        
        try:
            logger.info(f"Executing command: {command}")
            
            stdin, stdout, stderr = self.client.exec_command(command, timeout=timeout)
            
            # Output'ları oku
            stdout_content = stdout.read().decode('utf-8').strip()
            stderr_content = stderr.read().decode('utf-8').strip()
            
            # Exit code kontrol et
            exit_status = stdout.channel.recv_exit_status()
            
            if exit_status == 0:
                logger.info(f"Command executed successfully: {command}")
                return True, stdout_content, stderr_content
            else:
                logger.warning(f"Command failed with exit code {exit_status}: {command}")
                return False, stdout_content, stderr_content
                
        except Exception as e:
            error_msg = f"Command execution error: {str(e)}"
            logger.error(error_msg)
            return False, "", error_msg
    
    async def execute_multiple_commands(self, commands: List[str], delay: float = 1.0) -> List[Dict]:
        """
        Birden fazla komut çalıştırır
        Returns: List[{command, success, stdout, stderr, timestamp}]
        """
        results = []
        
        for command in commands:
            start_time = datetime.now()
            success, stdout, stderr = await self.execute_command(command)
            
            result = {
                "command": command,
                "success": success,
                "stdout": stdout,
                "stderr": stderr,
                "timestamp": start_time.isoformat(),
                "execution_time": (datetime.now() - start_time).total_seconds()
            }
            
            results.append(result)
            
            # Komutlar arası bekleme
            if delay > 0 and command != commands[-1]:
                await asyncio.sleep(delay)
        
        return results
    
    def disconnect(self):
        """SSH bağlantısını kapatır"""
        if self.client:
            try:
                self.client.close()
                logger.info("SSH connection closed")
            except Exception as e:
                logger.error(f"Error closing SSH connection: {e}")
            finally:
                self.connected = False
                self.client = None
    
    def __del__(self):
        """Destructor - bağlantıyı kapat"""
        self.disconnect()


class NetworkDeviceManager:
    """Ağ cihazları için özel komutlar ve konfigürasyonlar"""
    
    # Cihaz tipine göre komut şablonları
    DEVICE_COMMANDS = {
        "cisco_ios": {
            "show_version": "show version",
            "show_interfaces": "show ip interface brief",
            "show_running_config": "show running-config",
            "show_vlan": "show vlan brief",
            "save_config": "write memory",
            "show_inventory": "show inventory"
        },
        "mikrotik": {
            "show_version": "/system resource print",
            "show_interfaces": "/interface print",
            "show_ip_addresses": "/ip address print",
            "show_routes": "/ip route print",
            "export_config": "/export compact",
            "show_system": "/system identity print"
        },
        "ubuntu": {
            "show_version": "lsb_release -a",
            "show_interfaces": "ip addr show",
            "show_routes": "ip route show",
            "show_processes": "ps aux",
            "show_disk": "df -h",
            "show_memory": "free -h"
        },
        "windows": {
            "show_version": "ver",
            "show_interfaces": "ipconfig /all",
            "show_routes": "route print",
            "show_services": "net start",
            "show_processes": "tasklist"
        }
    }
    
    @staticmethod
    def get_device_commands(device_type: str) -> Dict[str, str]:
        """Cihaz tipine göre kullanılabilir komutları döner"""
        return NetworkDeviceManager.DEVICE_COMMANDS.get(device_type.lower(), {})
    
    @staticmethod
    def get_health_check_commands(device_type: str) -> List[str]:
        """Cihaz sağlığını kontrol etmek için temel komutlar"""
        commands_map = {
            "cisco_ios": ["show version", "show ip interface brief"],
            "mikrotik": ["/system resource print", "/interface print"],
            "ubuntu": ["uptime", "ip addr show"],
            "windows": ["ver", "ipconfig"]
        }
        return commands_map.get(device_type.lower(), ["echo 'Unknown device type'"])


# Test fonksiyonu - artık dinamik
async def test_ssh_connection(host: str, username: str, password: str, port: int = 22, test_commands: List[str] = None):
    """
    SSH bağlantısını test eder - Dinamik parametreler
    Args:
        host: Hedef IP adresi
        username: SSH kullanıcı adı  
        password: SSH şifresi
        port: SSH port (default: 22)
        test_commands: Test komutları listesi
    Returns:
        Dict: Test sonuçları
    """
    connector = SSHConnector()
    
    # Default test komutları
    if test_commands is None:
        test_commands = ["echo 'SSH Connection Test'", "whoami", "pwd"]
    
    test_result = {
        "connection": {"success": False, "message": "", "host": host, "username": username},
        "commands": [],
        "summary": {"total": len(test_commands), "successful": 0, "failed": 0}
    }
    
    try:
        # Bağlantı testi
        success, message = await connector.connect(
            host=host,
            username=username,
            password=password,
            port=port
        )
        
        test_result["connection"]["success"] = success
        test_result["connection"]["message"] = message
        
        if success:
            logger.info(f"✅ Connection successful to {host}: {message}")
            
            # Test komutlarını çalıştır
            results = await connector.execute_multiple_commands(test_commands)
            test_result["commands"] = results
            
            # İstatistikleri hesapla
            successful = sum(1 for r in results if r["success"])
            test_result["summary"]["successful"] = successful
            test_result["summary"]["failed"] = len(results) - successful
            
            logger.info(f"Commands executed: {successful}/{len(results)} successful")
            
        else:
            logger.error(f"❌ Connection failed to {host}: {message}")
    
    except Exception as e:
        error_msg = f"Unexpected error during test: {str(e)}"
        test_result["connection"]["message"] = error_msg
        logger.error(error_msg)
    
    finally:
        connector.disconnect()
    
    return test_result

# Cihaz tipine göre test komutları önerileri
def get_test_commands_for_device_type(device_type: str) -> List[str]:
    """Cihaz tipine göre uygun test komutları döner"""
    test_commands_map = {
        "cisco_ios": [
            "show version | include Software",
            "show ip interface brief | count",
            "show users"
        ],
        "mikrotik": [
            "/system identity print",
            "/system resource print",
            "/interface print count-only"
        ],
        "ubuntu": [
            "uname -a",
            "whoami",
            "uptime",
            "ip addr show | grep -c inet"
        ],
        "windows": [
            "ver",
            "whoami",
            "ipconfig | findstr IPv4"
        ],
        "juniper": [
            "show version | match Junos",
            "show interfaces terse | count"
        ]
    }
    
    return test_commands_map.get(device_type.lower(), [
        "echo 'Connection Test'",
        "whoami",
        "pwd"
    ])

# CLI test interface - sadece geliştirme amaçlı
async def interactive_test():
    """İnteraktif SSH test - sadece geliştirme için"""
    print("🔧 SSH Connection Interactive Test")
    print("=" * 50)
    
    try:
        # Kullanıcıdan bilgileri al
        host = input("Host IP: ").strip()
        username = input("Username: ").strip()
        password = input("Password: ").strip()
        port_input = input("Port (default 22): ").strip()
        device_type = input("Device type (cisco_ios/mikrotik/ubuntu/windows): ").strip()
        
        port = int(port_input) if port_input else 22
        
        # Cihaz tipine göre test komutları
        test_commands = get_test_commands_for_device_type(device_type)
        
        print(f"\n🔄 Testing connection to {host}...")
        print(f"📋 Test commands: {', '.join(test_commands)}")
        
        # Test çalıştır
        result = await test_ssh_connection(host, username, password, port, test_commands)
        
        # Sonuçları yazdır
        print("\n" + "="*50)
        print("📊 TEST RESULTS")
        print("="*50)
        
        if result["connection"]["success"]:
            print(f"✅ Connection: SUCCESS")
            print(f"📡 Host: {result['connection']['host']}")
            print(f"👤 User: {result['connection']['username']}")
            
            print(f"\n📈 Command Results: {result['summary']['successful']}/{result['summary']['total']} successful")
            
            for cmd_result in result["commands"]:
                status = "✅" if cmd_result["success"] else "❌"
                print(f"\n{status} {cmd_result['command']}")
                if cmd_result["stdout"]:
                    print(f"   Output: {cmd_result['stdout'][:100]}{'...' if len(cmd_result['stdout']) > 100 else ''}")
                if cmd_result["stderr"]:
                    print(f"   Error: {cmd_result['stderr']}")
                print(f"   Time: {cmd_result['execution_time']:.2f}s")
        else:
            print(f"❌ Connection: FAILED")
            print(f"💥 Error: {result['connection']['message']}")
        
    except KeyboardInterrupt:
        print("\n👋 Test cancelled by user")
    except Exception as e:
        print(f"\n💥 Test failed: {str(e)}")

if __name__ == "__main__":
    # İnteraktif test çalıştır
    asyncio.run(interactive_test())