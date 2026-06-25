package com.bidly.bidly_backend.service;

import com.bidly.bidly_backend.repository.UsuarioRolRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class UsuarioRolService {

    private static final String ROL_DEFAULT = "postor";

    @Autowired
    private UsuarioRolRepository usuarioRolRepository;

    public String obtenerRol(Long clienteId) {
        return usuarioRolRepository.findById(clienteId)
                .map(u -> u.getRol() != null ? u.getRol() : ROL_DEFAULT)
                .orElse(ROL_DEFAULT);
    }
}
