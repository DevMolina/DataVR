def calcular_dv_dian(nit):
    """
    Calcula el dígito de verificación para un NIT según el algoritmo de la DIAN (Colombia).
    
    Args:
        nit (str or int): El número de identificación tributaria sin el dígito de verificación.
        
    Returns:
        int: El dígito de verificación calculado.
    """
    # Convertir a string y asegurarse de que solo tenga números
    nit_str = str(nit).strip()
    if not nit_str.isdigit():
        raise ValueError("El NIT debe contener solo números.")
    
    # Pesos definidos por la DIAN (de derecha a izquierda)
    pesos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]
    
    # La lógica de rellenar con ceros a la izquierda hasta 15 dígitos es equivalente
    # a iterar desde el dígito más a la derecha hacia la izquierda, ya que
    # los ceros a la izquierda multiplicados por cualquier peso darían 0.
    
    suma = 0
    # Iteramos sobre el NIT invertido para multiplicar cada dígito por su peso correspondiente
    for i, digito in enumerate(reversed(nit_str)):
        if i < len(pesos):
            suma += int(digito) * pesos[i]
            
    residuo = suma % 11
    
    if residuo > 1:
        dv = 11 - residuo
    else:
        dv = residuo
        
    return dv

if __name__ == "__main__":
    # Prueba con el ejemplo proporcionado
    nit_prueba = "900453866"
    digitoVerificacion = calcular_dv_dian(nit_prueba)
    resultado = nit_prueba + str(digitoVerificacion)
    print(f"NIT: {nit_prueba}")
    print(f"DV Calculado: {digitoVerificacion}")
    print(f"Resultado: {resultado}")
    
