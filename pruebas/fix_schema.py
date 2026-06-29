import os
import sys
import django

# Add parent directory to path to find sitelecable module
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sitelecable.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    # Fix mufas table
    cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'mufas' ORDER BY ordinal_position")
    mufas_columns = [row[0] for row in cursor.fetchall()]
    print("Current mufas columns:", mufas_columns)
    
    if 'latitud' not in mufas_columns:
        cursor.execute("ALTER TABLE mufas ADD COLUMN latitud DECIMAL(10, 8)")
        print("Added latitud column to mufas")
    if 'longitud' not in mufas_columns:
        cursor.execute("ALTER TABLE mufas ADD COLUMN longitud DECIMAL(11, 8)")
        print("Added longitud column to mufas")
    
    # Fix sectores table
    cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'sectores' ORDER BY ordinal_position")
    sectores_columns = [row[0] for row in cursor.fetchall()]
    print("Current sectores columns:", sectores_columns)
    
    if 'descripcion_perimetro' not in sectores_columns:
        cursor.execute("ALTER TABLE sectores ADD COLUMN descripcion_perimetro TEXT")
        print("Added descripcion_perimetro column to sectores")
    
    # Fix cajas_nap table - check for missing columns
    cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'cajas_nap' ORDER BY ordinal_position")
    cajas_columns = [row[0] for row in cursor.fetchall()]
    print("Current cajas_nap columns:", cajas_columns)
    
    if 'personal_id' not in cajas_columns:
        cursor.execute("ALTER TABLE cajas_nap ADD COLUMN personal_id INTEGER")
        print("Added personal_id column to cajas_nap")
    
    # Check sedes table for missing columns
    cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'sedes' ORDER BY ordinal_position")
    sedes_columns = [row[0] for row in cursor.fetchall()]
    print("Current sedes columns:", sedes_columns)
    
    if 'activo' not in sedes_columns:
        cursor.execute("ALTER TABLE sedes ADD COLUMN activo BOOLEAN DEFAULT TRUE")
        print("Added activo column to sedes")
    
    # Check hubs table for missing columns
    cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'hubs' ORDER BY ordinal_position")
    hubs_columns = [row[0] for row in cursor.fetchall()]
    print("Current hubs columns:", hubs_columns)
    
    if 'activo' not in hubs_columns:
        cursor.execute("ALTER TABLE hubs ADD COLUMN activo BOOLEAN DEFAULT TRUE")
        print("Added activo column to hubs")
    
    # Check fibras_opticas table for missing columns
    cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'fibras_opticas' ORDER BY ordinal_position")
    fibras_columns = [row[0] for row in cursor.fetchall()]
    print("Current fibras_opticas columns:", fibras_columns)
    
    if 'activo' not in fibras_columns:
        cursor.execute("ALTER TABLE fibras_opticas ADD COLUMN activo BOOLEAN DEFAULT TRUE")
        print("Added activo column to fibras_opticas")
    
    if 'descripcion_ruta' not in fibras_columns:
        cursor.execute("ALTER TABLE fibras_opticas ADD COLUMN descripcion_ruta TEXT")
        print("Added descripcion_ruta column to fibras_opticas")
    
    # Check planes table for missing columns
    cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'planes' ORDER BY ordinal_position")
    planes_columns = [row[0] for row in cursor.fetchall()]
    print("Current planes columns:", planes_columns)
    
    if 'admite_prorrogas' not in planes_columns:
        cursor.execute("ALTER TABLE planes ADD COLUMN admite_prorrogas BOOLEAN DEFAULT FALSE")
        print("Added admite_prorrogas column to planes")

print("Done")
