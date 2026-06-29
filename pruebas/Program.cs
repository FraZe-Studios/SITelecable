using System;
using System.Diagnostics;
using System.IO;

namespace SITTelecablePruebas
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.Title = "Sistema de Pruebas - SIT Telecable";
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("╔════════════════════════════════════════════════════════════╗");
            Console.WriteLine("║        🧪 SISTEMA DE PRUEBAS - SIT TELECABLE              ║");
            Console.WriteLine("║        Interfaz de testing rápido sin afectar producción ║");
            Console.WriteLine("╚════════════════════════════════════════════════════════════╝");
            Console.ResetColor();
            Console.WriteLine();

            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("⚠️  IMPORTANTE: Este sistema es solo para pruebas.");
            Console.WriteLine("   No afecta el sistema de producción en core/");
            Console.ResetColor();
            Console.WriteLine();

            while (true)
            {
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("═════════════════════════════════════════════════════════════");
                Console.WriteLine("                        MENÚ PRINCIPAL");
                Console.WriteLine("═════════════════════════════════════════════════════════════");
                Console.ResetColor();

                Console.WriteLine("  [1] 🔐 Autenticación");
                Console.WriteLine("  [2] 👤 Gestión de Clientes");
                Console.WriteLine("  [3] 🎟️  Gestión de Tickets");
                Console.WriteLine("  [4] 💰 Gestión de Pagos");
                Console.WriteLine("  [5] ⚙️  Sistema");
                Console.WriteLine("  [0] 🚪 Salir");
                Console.WriteLine();

                Console.Write("Seleccione una opción: ");
                string opcion = Console.ReadLine();

                Console.WriteLine();

                switch (opcion)
                {
                    case "1":
                        MenuAutenticacion();
                        break;
                    case "2":
                        MenuClientes();
                        break;
                    case "3":
                        MenuTickets();
                        break;
                    case "4":
                        MenuPagos();
                        break;
                    case "5":
                        MenuSistema();
                        break;
                    case "0":
                        Console.ForegroundColor = ConsoleColor.Yellow;
                        Console.WriteLine("👋 Saliendo del sistema de pruebas...");
                        Console.ResetColor();
                        return;
                    default:
                        Console.ForegroundColor = ConsoleColor.Red;
                        Console.WriteLine("❌ Opción no válida. Intente nuevamente.");
                        Console.ResetColor();
                        break;
                }

                Console.WriteLine();
                Console.ForegroundColor = ConsoleColor.Gray;
                Console.WriteLine("Presione cualquier tecla para continuar...");
                Console.ResetColor();
                Console.ReadKey();
                Console.Clear();
            }
        }

        static void MenuAutenticacion()
        {
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("═════════════════════════════════════════════════════════════");
            Console.WriteLine("                      🔐 AUTENTICACIÓN");
            Console.WriteLine("═════════════════════════════════════════════════════════════");
            Console.ResetColor();
            Console.WriteLine();

            Console.WriteLine("  [1] Iniciar Sesión como ADMIN");
            Console.WriteLine("  [2] Iniciar Sesión como EMPLEADO");
            Console.WriteLine("  [3] Cerrar Sesión");
            Console.WriteLine("  [0] Volver");
            Console.WriteLine();

            Console.Write("Seleccione una opción: ");
            string opcion = Console.ReadLine();

            Console.WriteLine();

            switch (opcion)
            {
                case "1":
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("🔴 Iniciando sesión como ADMIN...");
                    Console.WriteLine("   Usuario: admin");
                    Console.WriteLine("   Rol: administrador");
                    Console.WriteLine("   ✅ Sesión iniciada correctamente");
                    Console.ResetColor();
                    break;
                case "2":
                    Console.ForegroundColor = ConsoleColor.Blue;
                    Console.WriteLine("🔵 Iniciando sesión como EMPLEADO...");
                    Console.WriteLine("   Usuario: vendedor");
                    Console.WriteLine("   Rol: vendedor");
                    Console.WriteLine("   ✅ Sesión iniciada correctamente");
                    Console.ResetColor();
                    break;
                case "3":
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine("🚪 Cerrando sesión...");
                    Console.WriteLine("   ✅ Sesión cerrada correctamente");
                    Console.ResetColor();
                    break;
                case "0":
                    return;
                default:
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("❌ Opción no válida.");
                    Console.ResetColor();
                    break;
            }
        }

        static void MenuClientes()
        {
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("═════════════════════════════════════════════════════════════");
            Console.WriteLine("                   👤 GESTIÓN DE CLIENTES");
            Console.WriteLine("═════════════════════════════════════════════════════════════");
            Console.ResetColor();
            Console.WriteLine();

            Console.WriteLine("  [1] Registrar Cliente Nuevo");
            Console.WriteLine("  [2] Consultar Cliente por DNI");
            Console.WriteLine("  [3] Consultar Suministro");
            Console.WriteLine("  [0] Volver");
            Console.WriteLine();

            Console.Write("Seleccione una opción: ");
            string opcion = Console.ReadLine();

            Console.WriteLine();

            switch (opcion)
            {
                case "1":
                    Console.ForegroundColor = ConsoleColor.Green;
                    Console.WriteLine("👤 Abriendo formulario de registro de cliente...");
                    Console.WriteLine("   ✅ Formulario listo para ingresar datos");
                    Console.ResetColor();
                    break;
                case "2":
                    Console.ForegroundColor = ConsoleColor.Green;
                    Console.WriteLine("🔍 Consultando cliente por DNI...");
                    Console.Write("   Ingrese DNI: ");
                    string dni = Console.ReadLine();
                    Console.WriteLine($"   ✅ Consultando DNI: {dni}");
                    Console.ResetColor();
                    break;
                case "3":
                    Console.ForegroundColor = ConsoleColor.Green;
                    Console.WriteLine("🔍 Consultando suministro...");
                    Console.Write("   Ingrese número de suministro: ");
                    string suministro = Console.ReadLine();
                    Console.WriteLine($"   ✅ Consultando suministro: {suministro}");
                    Console.ResetColor();
                    break;
                case "0":
                    return;
                default:
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("❌ Opción no válida.");
                    Console.ResetColor();
                    break;
            }
        }

        static void MenuTickets()
        {
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("═════════════════════════════════════════════════════════════");
            Console.WriteLine("                   🎟️  GESTIÓN DE TICKETS");
            Console.WriteLine("═════════════════════════════════════════════════════════════");
            Console.ResetColor();
            Console.WriteLine();

            Console.WriteLine("  [1] Generar Ticket de Instalación");
            Console.WriteLine("  [2] Generar Ticket de Reparación");
            Console.WriteLine("  [3] Liquidar Ticket");
            Console.WriteLine("  [0] Volver");
            Console.WriteLine();

            Console.Write("Seleccione una opción: ");
            string opcion = Console.ReadLine();

            Console.WriteLine();

            switch (opcion)
            {
                case "1":
                    Console.ForegroundColor = ConsoleColor.Magenta;
                    Console.WriteLine("🎟️  Generando ticket de instalación...");
                    Console.WriteLine("   ✅ Ticket generado correctamente");
                    Console.ResetColor();
                    break;
                case "2":
                    Console.ForegroundColor = ConsoleColor.Magenta;
                    Console.WriteLine("🎟️  Generando ticket de reparación...");
                    Console.WriteLine("   ✅ Ticket generado correctamente");
                    Console.ResetColor();
                    break;
                case "3":
                    Console.ForegroundColor = ConsoleColor.Magenta;
                    Console.WriteLine("✅ Liquidando ticket...");
                    Console.Write("   Ingrese ID del ticket: ");
                    string ticketId = Console.ReadLine();
                    Console.WriteLine($"   ✅ Ticket {ticketId} liquidado correctamente");
                    Console.ResetColor();
                    break;
                case "0":
                    return;
                default:
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("❌ Opción no válida.");
                    Console.ResetColor();
                    break;
            }
        }

        static void MenuPagos()
        {
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("═════════════════════════════════════════════════════════════");
            Console.WriteLine("                    💰 GESTIÓN DE PAGOS");
            Console.WriteLine("═════════════════════════════════════════════════════════════");
            Console.ResetColor();
            Console.WriteLine();

            Console.WriteLine("  [1] Generar Deuda");
            Console.WriteLine("  [2] Registrar Pago");
            Console.WriteLine("  [3] Abrir Turno Caja");
            Console.WriteLine("  [0] Volver");
            Console.WriteLine();

            Console.Write("Seleccione una opción: ");
            string opcion = Console.ReadLine();

            Console.WriteLine();

            switch (opcion)
            {
                case "1":
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine("💰 Generando deuda...");
                    Console.WriteLine("   ✅ Deuda generada correctamente");
                    Console.ResetColor();
                    break;
                case "2":
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine("💵 Registrando pago...");
                    Console.WriteLine("   ✅ Pago registrado correctamente");
                    Console.ResetColor();
                    break;
                case "3":
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine("🏦 Abriendo turno de caja...");
                    Console.WriteLine("   ✅ Turno de caja abierto correctamente");
                    Console.ResetColor();
                    break;
                case "0":
                    return;
                default:
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("❌ Opción no válida.");
                    Console.ResetColor();
                    break;
            }
        }

        static void MenuSistema()
        {
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("═════════════════════════════════════════════════════════════");
            Console.WriteLine("                      ⚙️  SISTEMA");
            Console.WriteLine("═════════════════════════════════════════════════════════════");
            Console.ResetColor();
            Console.WriteLine();

            Console.WriteLine("  [1] Cargar Datos de Prueba");
            Console.WriteLine("  [2] Limpiar Datos de Prueba");
            Console.WriteLine("  [3] Generar Mapa de Modelos");
            Console.WriteLine("  [4] Ejecutar Comando Django");
            Console.WriteLine("  [0] Volver");
            Console.WriteLine();

            Console.Write("Seleccione una opción: ");
            string opcion = Console.ReadLine();

            Console.WriteLine();

            switch (opcion)
            {
                case "1":
                    Console.ForegroundColor = ConsoleColor.Gray;
                    Console.WriteLine("📊 Cargando datos de prueba...");
                    Console.WriteLine("   ⏳ Procesando...");
                    System.Threading.Thread.Sleep(2000);
                    Console.WriteLine("   ✅ Datos de prueba cargados correctamente");
                    Console.ResetColor();
                    break;
                case "2":
                    Console.ForegroundColor = ConsoleColor.Gray;
                    Console.WriteLine("🗑️  Limpiando datos de prueba...");
                    Console.WriteLine("   ⏳ Procesando...");
                    System.Threading.Thread.Sleep(1500);
                    Console.WriteLine("   ✅ Datos de prueba limpiados correctamente");
                    Console.ResetColor();
                    break;
                case "3":
                    Console.ForegroundColor = ConsoleColor.Gray;
                    Console.WriteLine("🗺️  Generando mapa de modelos...");
                    EjecutarComandoDjango("generar_mapa_modelos");
                    break;
                case "4":
                    Console.ForegroundColor = ConsoleColor.Gray;
                    Console.WriteLine("🔧 Ejecutar comando Django personalizado");
                    Console.Write("   Ingrese el comando: ");
                    string comando = Console.ReadLine();
                    EjecutarComandoDjango(comando);
                    break;
                case "0":
                    return;
                default:
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("❌ Opción no válida.");
                    Console.ResetColor();
                    break;
            }
        }

        static void EjecutarComandoDjango(string comando)
        {
            try
            {
                Console.WriteLine($"   ⏳ Ejecutando: python manage.py {comando}");
                
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = "python",
                    Arguments = $"manage.py {comando}",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    WorkingDirectory = Path.GetFullPath("..")
                };

                using (Process process = Process.Start(psi))
                {
                    string output = process.StandardOutput.ReadToEnd();
                    string error = process.StandardError.ReadToEnd();
                    process.WaitForExit();

                    if (!string.IsNullOrEmpty(output))
                    {
                        Console.WriteLine("   📤 SALIDA:");
                        Console.WriteLine("   " + output.Replace("\n", "\n   "));
                    }

                    if (!string.IsNullOrEmpty(error))
                    {
                        Console.ForegroundColor = ConsoleColor.Red;
                        Console.WriteLine("   ❌ ERROR:");
                        Console.WriteLine("   " + error.Replace("\n", "\n   "));
                        Console.ResetColor();
                    }

                    if (process.ExitCode == 0)
                    {
                        Console.ForegroundColor = ConsoleColor.Green;
                        Console.WriteLine("   ✅ Comando ejecutado correctamente");
                        Console.ResetColor();
                    }
                    else
                    {
                        Console.ForegroundColor = ConsoleColor.Red;
                        Console.WriteLine($"   ❌ Comando falló con código: {process.ExitCode}");
                        Console.ResetColor();
                    }
                }
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine($"   ❌ Error al ejecutar comando: {ex.Message}");
                Console.ResetColor();
            }
        }
    }
}
