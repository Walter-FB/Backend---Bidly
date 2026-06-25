package com.bidly.bidly_backend.repository;

import com.bidly.bidly_backend.model.Notificacion;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface NotificacionRepository extends JpaRepository<Notificacion, Long> {
    List<Notificacion> findByClienteIdentificador(Long clienteId);
}
