import random
from datosUsuario1 import Persona

def generar_registros(cantidad_natural, cantidad_juridico, cantidad_minima_vehiculos, cantidad_maxima_vehiculos):
    """
    Genera una lista de diccionarios con datos de personas y vehículos.
    
    Args:
        cantidad_natural (int): Número de personas naturales a generar.
        cantidad_juridico (int): Número de personas jurídicas a generar.
        cantidad_minima_vehiculos (int): Mínimo de vehículos por usuario.
        cantidad_maxima_vehiculos (int): Máximo de vehículos por usuario.
        
    Returns:
        list: Lista de diccionarios con los datos generados.
    """
    personas = ([Persona("Natural", cantidad_minima_vehiculos, cantidad_maxima_vehiculos) for _ in range(cantidad_natural)] +
                [Persona("Juridico", cantidad_minima_vehiculos, cantidad_maxima_vehiculos) for _ in range(cantidad_juridico)])
    
    random.shuffle(personas)

    datos = []
    for persona in personas:
        for vehiculo in persona.vehiculos:
            datos.append({
                "nombre": persona.razon_social,
                "representante": persona.nombre,
                "apellido": persona.apellido,
                "documento": persona.documento,
                "verificacion": persona.cod_ver,
                "tipo": persona.nit,
                "fiscal": persona.res_fiscal,
                "direccion": persona.dir,
                "pais": persona.pais,
                "departamento": persona.dep,
                "municipio": persona.mun,
                "email": persona.email,
                "telefono": persona.cel,
                "telefono2": persona.tel_eme,
                "placa": vehiculo.placa,
                "categoria": vehiculo.categoria
            })
    return datos
